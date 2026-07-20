/** @typedef {import("../types/mrp.types").AllocatedRequirement} AllocatedRequirement */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../types/mrp.types").ItemId} ItemId */
/** @typedef {import("../types/mrp.types").ProcurementType} ProcurementType */
/** @typedef {import("../types/mrp.types").Recommendation} Recommendation */

/**
 * Converts Item Master records into an in-memory Map<ItemId, ProcurementType> for O(1) lookup.
 *
 * **Architectural & Boundary Assumptions**:
 * - Procurement Type Resolution: Reads each item's configured `procurementType` ("PURCHASE" vs "PRODUCTION").
 * - Upstream Validation: Planning validation (`planning.validation.js`) guarantees item master integrity prior to engine execution.
 * - Defensive Default: If an item's `procurementType` is unconfigured or invalid, defaults to "PURCHASE" to prevent planning engine halts.
 *
 * @param {Item[]} [items] Array of item master domain records
 * @returns {Map<ItemId, ProcurementType>} Map tracking procurement strategy per item ID
 */
function createProcurementLookup(items) {
  const itemMap = new Map();
  if (!Array.isArray(items)) {
    return itemMap;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && typeof item.itemId === "number") {
      const type = item.procurementType === "PRODUCTION" ? "PRODUCTION" : "PURCHASE";
      itemMap.set(item.itemId, type);
    }
  }

  return itemMap;
}

/**
 * Determines whether an unfulfilled shortage for an item requires a PURCHASE or PRODUCTION recommendation.
 *
 * @param {Map<ItemId, ProcurementType>} itemMap Item procurement lookup map
 * @param {ItemId} itemId Item ID requiring supply
 * @returns {ProcurementType} Determined recommendation strategy
 */
function determineRecommendationType(itemMap, itemId) {
  if (itemMap && itemMap.has(itemId)) {
    return itemMap.get(itemId);
  }
  return "PURCHASE";
}

/**
 * Factory function creating an immutable Recommendation record preserving end-to-end demand lineage.
 *
 * **Immutability Safeguards**:
 * - Date Instance Isolation: Clones `requiredDate` into a fresh `Date` object preventing reference leakage.
 * - Path Array Copying: Deep-copies the traversal `path` array so output record modifications do not contaminate input arrays.
 *
 * @param {AllocatedRequirement} allocatedReq Parent allocated requirement with remaining shortfall
 * @param {ProcurementType} recommendationType Derived recommendation type
 * @returns {Recommendation} Freshly allocated Recommendation object
 */
function createRecommendation(allocatedReq, recommendationType) {
  return {
    recommendationType,
    itemId: allocatedReq.itemId,
    quantity: allocatedReq.remainingShortage,
    requiredDate: allocatedReq.requiredDate instanceof Date
      ? new Date(allocatedReq.requiredDate.getTime())
      : new Date(allocatedReq.requiredDate),
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
 * - Unaggregated Lineage Rule: Every unfulfilled demand line generates exactly ONE recommendation record. Recommendations are intentionally NEVER aggregated across sales orders or items to preserve end-to-end demand lineage.
 * - Centralized Domain Types: Consumes domain types imported from `mrp.types.js`.
 * - O(N) Time Complexity: Performs sequential iteration with O(1) map lookups.
 * - Input Immutability: Inputs (`allocatedRequirements`, `items`) are never mutated.
 * - Output Isolation: Returned array and `Recommendation` objects are newly allocated.
 *
 * @param {AllocatedRequirement[]} allocatedRequirements Allocated requirements from allocateSupply()
 * @param {Item[]} [items] Item master list containing procurementType configurations
 * @returns {Recommendation[]} Array of generated planning recommendations
 */
function generateRecommendations(allocatedRequirements, items = []) {
  if (!Array.isArray(allocatedRequirements) || allocatedRequirements.length === 0) {
    return [];
  }

  const itemMap = createProcurementLookup(items);
  const results = [];

  for (let i = 0; i < allocatedRequirements.length; i++) {
    const req = allocatedRequirements[i];

    if (typeof req.remainingShortage !== "number" || req.remainingShortage <= 0) {
      continue;
    }

    const recommendationType = determineRecommendationType(itemMap, req.itemId);
    results.push(createRecommendation(req, recommendationType));
  }

  return results;
}

module.exports = {
  generateRecommendations,
};
