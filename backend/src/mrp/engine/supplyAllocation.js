/** @typedef {import("./inventoryNetting").NetRequirement} NetRequirement */

/**
 * @typedef {Object} SupplyRecord
 * @property {string|number} [id]
 * @property {string} [purchaseOrderId]
 * @property {string} [productionOrderId]
 * @property {number} itemId
 * @property {number} [openQuantity]
 * @property {number} [quantity]
 * @property {Date|string} expectedDate
 */

/**
 * @typedef {Object} AllocatedRequirement
 * @property {"SALES_ORDER"} demandSourceType
 * @property {string} salesOrderId
 * @property {number} salesOrderLineId
 * @property {number} itemId
 * @property {number} grossRequirement
 * @property {number} availableInventoryUsed
 * @property {number} netRequirement
 * @property {number} purchaseSupplyUsed
 * @property {number} productionSupplyUsed
 * @property {number} remainingShortage
 * @property {Date} requiredDate
 * @property {number} bomLevel
 * @property {number[]} path
 */

/**
 * Indexes open supply orders by itemId into a Map, sorted ascending by expectedDate.
 *
 * **Business Behaviors & Guarantees**:
 * - Closed Order Filtering: Supply records with `openQuantity <= 0` are filtered out because fully received purchase orders or completed work orders cannot provide available supply.
 * - Earliest-Supply-First Priority: Within each item's supply pool, orders are sorted ascending by `expectedDate`. Consuming earlier incoming supply first satisfies demand as early as possible and minimizes inventory holding time.
 * - Recommendation Linkage: Order identifiers (`purchaseOrderId` / `productionOrderId`) are preserved on internal lookup objects to support Phase 6 recommendation auditing and action messaging.
 *
 * @param {SupplyRecord[]} [supplyList] Array of open purchase or production order records
 * @returns {Map<number, Array<{id: string|number, itemId: number, openQuantity: number, expectedDate: Date}>>} Lookup Map keyed by itemId
 */
function createSupplyLookup(supplyList) {
  const supplyMap = new Map();
  if (!Array.isArray(supplyList)) {
    return supplyMap;
  }

  for (let i = 0; i < supplyList.length; i++) {
    const item = supplyList[i];
    if (!item || typeof item.itemId !== "number") {
      continue;
    }

    const openQty = typeof item.openQuantity === "number"
      ? item.openQuantity
      : (typeof item.quantity === "number" ? item.quantity : 0);

    if (openQty <= 0) {
      continue;
    }

    const expectedDate = item.expectedDate instanceof Date
      ? item.expectedDate
      : new Date(item.expectedDate);

    if (isNaN(expectedDate.getTime())) {
      continue;
    }

    if (!supplyMap.has(item.itemId)) {
      supplyMap.set(item.itemId, []);
    }

    supplyMap.get(item.itemId).push({
      id: item.purchaseOrderId || item.productionOrderId || item.id || i,
      itemId: item.itemId,
      openQuantity: openQty,
      expectedDate,
    });
  }

  // Sort each item's supply pool by expectedDate ascending for deterministic earliest-supply-first allocation
  for (const list of supplyMap.values()) {
    list.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  }

  return supplyMap;
}

/**
 * Allocates available open quantities from a specific supply pool (Purchase or Production) for a given item.
 *
 * **Stateful Depletion & Date Constraint Semantics**:
 * - Date Constraint Rule: Supply is allocated ONLY if `expectedDate <= requiredDate`. Late incoming supply (`expectedDate > requiredDate`) is strictly ignored to prevent assigning late shipments to urgent customer orders.
 * - In-Place Lookup Mutation: Mutates `openQuantity` on the internal lookup objects in-place to track stateful cumulative depletion across sequential demand requirements.
 * - Upstream Invariant Assumption: Assumes `requiredDate` has been validated upstream by `planning.validation.js`.
 *
 * @param {Map<number, Array<{id: string|number, itemId: number, openQuantity: number, expectedDate: Date}>>} supplyMap Local supply pool map
 * @param {number} itemId Item ID to allocate supply for
 * @param {number} targetQuantity Target net requirement quantity to fulfill
 * @param {Date|string} requiredDate Target demand completion date
 * @returns {{allocatedQuantity: number, remainingTarget: number}} Quantity allocated and remaining target shortfall
 */
function allocateFromSupplyPool(supplyMap, itemId, targetQuantity, requiredDate) {
  if (targetQuantity <= 0 || !supplyMap || !supplyMap.has(itemId)) {
    return { allocatedQuantity: 0, remainingTarget: Math.max(0, targetQuantity) };
  }

  const supplyList = supplyMap.get(itemId);
  const targetTime = requiredDate instanceof Date ? requiredDate.getTime() : new Date(requiredDate).getTime();
  let allocatedQuantity = 0;
  let remainingTarget = targetQuantity;

  for (let i = 0; i < supplyList.length; i++) {
    if (remainingTarget <= 0) {
      break;
    }

    const supply = supplyList[i];

    // Date Rule: expectedDate <= requiredDate (Late supply must NOT be allocated)
    if (supply.expectedDate.getTime() > targetTime) {
      continue;
    }

    if (supply.openQuantity <= 0) {
      continue;
    }

    const allocation = Math.min(supply.openQuantity, remainingTarget);
    supply.openQuantity -= allocation;
    allocatedQuantity += allocation;
    remainingTarget -= allocation;
  }

  return {
    allocatedQuantity,
    remainingTarget,
  };
}

/**
 * Factory function assembling an immutable AllocatedRequirement record preserving demand traceability.
 *
 * **Immutability Safeguards**:
 * - Date Cloning: Clones `requiredDate` into a fresh `Date` instance to prevent reference mutation leakage.
 * - Path Array Cloning: Deep-copies the ancestry `path` array so output record modifications do not pollute input objects.
 * - Shortage Safeguard: Uses `Math.max(0, remainingShortage)` as a defensive guard against floating-point precision errors.
 *
 * @param {NetRequirement} netReq Parent NetRequirement object
 * @param {number} purchaseUsed Quantity offset using open Purchase Orders
 * @param {number} productionUsed Quantity offset using open Production Orders
 * @param {number} remainingShortage Remaining unfulfilled shortfall after all supply offsets
 * @returns {AllocatedRequirement} Freshly allocated AllocatedRequirement record
 */
function createAllocatedRequirement(netReq, purchaseUsed, productionUsed, remainingShortage) {
  return {
    demandSourceType: netReq.demandSourceType || "SALES_ORDER",
    salesOrderId: netReq.salesOrderId,
    salesOrderLineId: netReq.salesOrderLineId,
    itemId: netReq.itemId,
    grossRequirement: netReq.grossRequirement,
    availableInventoryUsed: netReq.availableInventoryUsed,
    netRequirement: netReq.netRequirement,
    purchaseSupplyUsed: purchaseUsed,
    productionSupplyUsed: productionUsed,
    remainingShortage: Math.max(0, remainingShortage),
    requiredDate: netReq.requiredDate instanceof Date
      ? new Date(netReq.requiredDate.getTime())
      : new Date(netReq.requiredDate),
    bomLevel: netReq.bomLevel,
    path: Array.isArray(netReq.path) ? [...netReq.path] : [],
  };
}

/**
 * Offsets net component requirements against committed open incoming supplies (Purchase Orders & Production Orders).
 *
 * **Architectural & Business Guarantees**:
 * - Priority Order: Purchase Orders allocated FIRST $\rightarrow$ Production Orders allocated SECOND.
 * - Date Constraint: Supply is allocated ONLY if `expectedDate <= requiredDate`. Late supply is strictly ignored.
 * - Cumulative Depletion: Supply order quantities are consumed statefully across requirements.
 * - Traceability Preserved: All lineage fields (`salesOrderId`, `salesOrderLineId`, `requiredDate`, `path`) remain unaggregated per demand line.
 * - Input Immutability: Inputs (`netRequirements`, `purchaseOrders`, `productionOrders`) are never mutated.
 * - Output Isolation: Returned collection is a newly allocated array of `AllocatedRequirement` objects.
 *
 * @param {NetRequirement[]} netRequirements Net requirements from calculateInventoryNetting()
 * @param {SupplyRecord[]} [purchaseOrders] Open Purchase Orders
 * @param {SupplyRecord[]} [productionOrders] Open Production Orders
 * @returns {AllocatedRequirement[]} Allocated requirements array with supply offsets and remaining shortfalls
 */
function allocateSupply(netRequirements, purchaseOrders = [], productionOrders = []) {
  if (!Array.isArray(netRequirements) || netRequirements.length === 0) {
    return [];
  }

  const purchaseMap = createSupplyLookup(purchaseOrders);
  const productionMap = createSupplyLookup(productionOrders);
  const results = [];

  for (let i = 0; i < netRequirements.length; i++) {
    const netReq = netRequirements[i];
    const initialNetRequirement = typeof netReq.netRequirement === "number" ? netReq.netRequirement : 0;

    if (initialNetRequirement <= 0) {
      results.push(createAllocatedRequirement(netReq, 0, 0, 0));
      continue;
    }

    // Priority 1: Purchase Supply
    const purchaseResult = allocateFromSupplyPool(
      purchaseMap,
      netReq.itemId,
      initialNetRequirement,
      netReq.requiredDate
    );

    const purchaseSupplyUsed = purchaseResult.allocatedQuantity;
    let currentShortage = purchaseResult.remainingTarget;

    // Priority 2: Production Supply
    let productionSupplyUsed = 0;
    if (currentShortage > 0) {
      const productionResult = allocateFromSupplyPool(
        productionMap,
        netReq.itemId,
        currentShortage,
        netReq.requiredDate
      );
      productionSupplyUsed = productionResult.allocatedQuantity;
      currentShortage = productionResult.remainingTarget;
    }

    results.push(
      createAllocatedRequirement(netReq, purchaseSupplyUsed, productionSupplyUsed, currentShortage)
    );
  }

  return results;
}

module.exports = {
  allocateSupply,
};
