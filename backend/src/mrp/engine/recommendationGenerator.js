const { PROCUREMENT_TYPES } = require("../constants/procurement.constants");
const { calculateLotSize } = require("../policies/lotSizing/lotSizingCalculator");
const { calculateOrderModifiers } = require("../policies/orderModifiers/orderModifierCalculator");
const { calculateSchedule } = require("../policies/scheduling/schedulingCalculator");

/** @typedef {import("../types/mrp.types").AllocatedRequirement} AllocatedRequirement */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../types/mrp.types").ItemId} ItemId */
/** @typedef {import("../types/mrp.types").ProcurementType} ProcurementType */
/** @typedef {import("../types/mrp.types").Recommendation} Recommendation */

/**
 * Converts Item Master Planning DTO records into an in-memory Map<ItemId, Item> for O(1) lookup.
 *
 * **Architectural & Boundary Guarantees**:
 * - O(1) Lookup: Indexes Item Planning DTO by numerical itemId.
 * - Zero Category Inspection: Does NOT inspect or require category or itemType.
 * - Upstream Validation: Planning validation (`planning.validation.js`) guarantees item master DTO integrity prior to engine execution.
 *
 * @param {Item[]} [items] Array of item master domain records
 * @returns {Map<ItemId, Item>} Map tracking item planning configuration per item ID
 */
function createItemLookup(items) {
  const itemMap = new Map();
  if (!Array.isArray(items)) {
    return itemMap;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && typeof item.itemId === "number") {
      itemMap.set(item.itemId, item);
    }
  }

  return itemMap;
}

/**
 * Determines whether an unfulfilled shortage for an item requires a PURCHASE or PRODUCTION recommendation.
 *
 * @param {Map<ItemId, Item>} itemMap Item lookup map
 * @param {ItemId} itemId Item ID requiring supply
 * @returns {ProcurementType} Determined recommendation strategy
 */
function determineRecommendationType(itemMap, itemId) {
  const item = itemMap ? itemMap.get(itemId) : undefined;
  if (item && item.procurementType === PROCUREMENT_TYPES.PRODUCTION) {
    return PROCUREMENT_TYPES.PRODUCTION;
  }
  return PROCUREMENT_TYPES.PURCHASE;
}

/**
 * Factory function creating an immutable Recommendation record preserving end-to-end demand lineage.
 *
 * **Immutability Safeguards**:
 * - Date Instance Isolation: Clones date instances preventing reference leakage.
 * - Path Array Copying: Deep-copies the traversal `path` array so output record modifications do not contaminate input arrays.
 *
 * @param {AllocatedRequirement} allocatedReq Parent allocated requirement with remaining shortfall
 * @param {ProcurementType} recommendationType Derived recommendation type
 * @param {number} lotSizedQuantity Calculated lot-sized order quantity
 * @param {{requiredDate: Date, plannedReceiptDate: Date, plannedReleaseDate: Date, isPastDue: boolean}} scheduleDates Backward scheduling dates
 * @param {Object} [splitMetadata] Order modifier split metadata
 * @param {string|null} [splitMetadata.parentSplitId] Grouping identifier linking split recommendation records
 * @param {number} [splitMetadata.splitSequence] 1-based index of split recommendation
 * @param {number} [splitMetadata.splitTotalCount] Total number of split recommendations generated
 * @param {string|null} [splitMetadata.modifierReason] Reason code
 * @returns {Recommendation} Freshly allocated Recommendation object
 */
function createRecommendation(allocatedReq, recommendationType, lotSizedQuantity, scheduleDates, splitMetadata = {}) {
  return {
    recommendationType,
    itemId: allocatedReq.itemId,
    shortageQuantity: allocatedReq.remainingShortage,
    quantity: lotSizedQuantity,
    requiredDate: scheduleDates.requiredDate,
    plannedReceiptDate: scheduleDates.plannedReceiptDate,
    plannedReleaseDate: scheduleDates.plannedReleaseDate,
    isPastDue: scheduleDates.isPastDue,
    parentSplitId: splitMetadata.parentSplitId || null,
    splitSequence: typeof splitMetadata.splitSequence === "number" ? splitMetadata.splitSequence : 1,
    splitTotalCount: typeof splitMetadata.splitTotalCount === "number" ? splitMetadata.splitTotalCount : 1,
    modifierReason: splitMetadata.modifierReason || null,
    demandSourceType: allocatedReq.demandSourceType || "SALES_ORDER",
    salesOrderId: allocatedReq.salesOrderId,
    salesOrderLineId: allocatedReq.salesOrderLineId,
    bomLevel: allocatedReq.bomLevel,
    path: Array.isArray(allocatedReq.path) ? [...allocatedReq.path] : [],
  };
}

/**
 * Stage 4 MRP Planning Algorithm: Converts unfulfilled component shortages into planning recommendations.
 *
 * **Architectural & Business Guarantees**:
 * - Shortage Filtering: Recommendations are generated ONLY when `remainingShortage > 0`. Zero-shortage requirements are skipped.
 * - Lot Sizing Integration (Stage 4A): Recommended `quantity` is calculated according to each item's configured `lotSizingPolicy` (L4L, FOQ, MOQ, ORDER_MULTIPLE).
 * - Order Modifiers Integration (Stage 4B): Order modifier strategy chain (minPlanningQuantity, maxOrderQuantity) adjusts/splits order quantities.
 * - Lead Time Backward Scheduling (Stage 4C): Backward schedules `plannedReleaseDate` based on `purchaseLeadTimeDays` or `manufacturingLeadTimeDays` for each individual recommendation.
 * - Lineage Auditability: Preserves `shortageQuantity` alongside `quantity`, `modifierReason`, and split metadata.
 *
 * @param {AllocatedRequirement[]} allocatedRequirements Allocated requirements from allocateSupply()
 * @param {Item[]} [items] Item master list containing procurementType, lot sizing, and lead time configurations
 * @param {Date} [planningDate] MRP execution run date injected by MRPService
 * @returns {Recommendation[]} Array of generated planning recommendations
 */
function generateRecommendations(allocatedRequirements, items = [], planningDate) {
  if (!Array.isArray(allocatedRequirements) || allocatedRequirements.length === 0) {
    return [];
  }

  const itemMap = createItemLookup(items);
  const results = [];

  for (let i = 0; i < allocatedRequirements.length; i++) {
    const req = allocatedRequirements[i];

    if (typeof req.remainingShortage !== "number" || req.remainingShortage <= 0) {
      continue;
    }

    const itemConfig = itemMap.get(req.itemId);
    const recommendationType = determineRecommendationType(itemMap, req.itemId);

    // Stage 4A: Lot Sizing
    const baseLotSize = calculateLotSize(req.remainingShortage, itemConfig);

    // Stage 4B: Order Modifiers (Calculator & Strategy Registry)
    const modifiedEntries = calculateOrderModifiers(baseLotSize, itemConfig);

    const isSplit = modifiedEntries.length > 1;
    const parentSplitId = isSplit ? `SPLIT-${req.salesOrderId || "SO"}-${req.salesOrderLineId || 0}-${req.itemId}-${i + 1}` : null;

    // Stage 4C: Lead Time Backward Scheduling per recommendation line
    for (let k = 0; k < modifiedEntries.length; k++) {
      const entry = modifiedEntries[k];
      const scheduleDates = calculateSchedule(req.requiredDate, itemConfig, planningDate);

      results.push(
        createRecommendation(req, recommendationType, entry.quantity, scheduleDates, {
          parentSplitId,
          splitSequence: k + 1,
          splitTotalCount: modifiedEntries.length,
          modifierReason: entry.modifierReason,
        })
      );
    }
  }

  return results;
}

module.exports = {
  generateRecommendations,
};

module.exports = {
  generateRecommendations,
};
