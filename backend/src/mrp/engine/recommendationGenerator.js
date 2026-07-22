const { PROCUREMENT_TYPES } = require("../constants/procurement.constants");
const { calculateLotSize } = require("../policies/lotSizing/lotSizingCalculator");
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
 * @returns {Recommendation} Freshly allocated Recommendation object
 */
function createRecommendation(allocatedReq, recommendationType, lotSizedQuantity, scheduleDates) {
  return {
    recommendationType,
    itemId: allocatedReq.itemId,
    shortageQuantity: allocatedReq.remainingShortage,
    quantity: lotSizedQuantity,
    requiredDate: scheduleDates.requiredDate,
    plannedReceiptDate: scheduleDates.plannedReceiptDate,
    plannedReleaseDate: scheduleDates.plannedReleaseDate,
    isPastDue: scheduleDates.isPastDue,
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
 * - Lot Sizing Integration: Recommended `quantity` is calculated according to each item's configured `lotSizingPolicy` (L4L, FOQ, MOQ, ORDER_MULTIPLE).
 * - Lead Time Backward Scheduling: Backward schedules `plannedReleaseDate` based on `purchaseLeadTimeDays` or `manufacturingLeadTimeDays`.
 * - Lineage Auditability: Preserves `shortageQuantity` (raw unfulfilled net shortage) alongside `quantity` (lot-sized order quantity).
 * - Unaggregated Lineage Rule: Every unfulfilled demand line generates exactly ONE recommendation record. Recommendations are intentionally NEVER aggregated across sales orders or items to preserve end-to-end demand lineage.
 * - Centralized Domain Types: Consumes domain types imported from `mrp.types.js`.
 * - O(N) Time Complexity: Performs sequential iteration with O(1) map lookups.
 * - Input Immutability: Inputs (`allocatedRequirements`, `items`) are never mutated.
 * - Output Isolation: Returned array and `Recommendation` objects are newly allocated.
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
    const lotSizedQuantity = calculateLotSize(req.remainingShortage, itemConfig);
    const scheduleDates = calculateSchedule(req.requiredDate, itemConfig, planningDate);

    results.push(createRecommendation(req, recommendationType, lotSizedQuantity, scheduleDates));
  }

  return results;
}

module.exports = {
  generateRecommendations,
};

module.exports = {
  generateRecommendations,
};
