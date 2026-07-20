/** @typedef {import("./bomExplosion").ExplodedRequirement} ExplodedRequirement */

/**
 * @typedef {Object} InventoryRecord
 * @property {number} itemId
 * @property {number} availableQuantity
 */

/**
 * @typedef {Object} NetRequirement
 * @property {"SALES_ORDER"} demandSourceType
 * @property {string} salesOrderId
 * @property {number} salesOrderLineId
 * @property {number} itemId
 * @property {number} grossRequirement
 * @property {number} availableInventoryUsed
 * @property {number} netRequirement
 * @property {Date} requiredDate
 * @property {number} bomLevel
 * @property {number[]} path
 */

/**
 * Builds an in-memory Map<itemId, availableQuantity> for O(1) inventory lookup and depletion tracking.
 *
 * **Business Behaviors**:
 * - Multi-record aggregation: If multiple inventory records exist for the same `itemId` (e.g. across multiple locations or bins), their available quantities are aggregated.
 * - Negative stock clamping: Negative inventory balances are clamped to zero using `Math.max(0, ...)` to prevent stock discrepancies from artificially inflating net requirements.
 *
 * @param {InventoryRecord[]} [inventory] Array of warehouse inventory records
 * @returns {Map<number, number>} Fresh Map tracking available stock per item
 */
function createInventoryLookup(inventory) {
  const inventoryMap = new Map();
  if (!Array.isArray(inventory)) {
    return inventoryMap;
  }

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && typeof item.itemId === "number" && typeof item.availableQuantity === "number") {
      const currentQty = inventoryMap.get(item.itemId) || 0;
      inventoryMap.set(item.itemId, Math.max(0, currentQty + item.availableQuantity));
    }
  }

  return inventoryMap;
}

/**
 * Calculates stock allocation and net shortfall for a given gross requirement.
 *
 * **Stateful Depletion Semantics**:
 * - The `inventoryMap` parameter is intentionally mutated in-place to track cumulative stock depletion.
 * - This mutation is strictly local to the current planning run because `createInventoryLookup` allocates a fresh Map.
 * - Callers must not share or reuse `inventoryMap` across independent planning runs.
 *
 * @param {Map<number, number>} inventoryMap Local inventory tracking map
 * @param {number} itemId Item ID to consume stock for
 * @param {number} grossRequirement Gross required component quantity
 * @returns {{availableInventoryUsed: number, netRequirement: number}} Calculated stock consumption and net shortfall
 */
function consumeInventory(inventoryMap, itemId, grossRequirement) {
  const currentAvailable = inventoryMap.get(itemId) || 0;
  const availableInventoryUsed = Math.min(currentAvailable, grossRequirement);
  const remainingStock = currentAvailable - availableInventoryUsed;
  const netRequirement = grossRequirement - availableInventoryUsed;

  inventoryMap.set(itemId, remainingStock);

  return {
    availableInventoryUsed,
    netRequirement,
  };
}

/**
 * Factory function assembling an immutable NetRequirement record preserving demand traceability.
 *
 * @param {ExplodedRequirement} requirement Parent exploded requirement
 * @param {number} availableInventoryUsed Quantity offset using on-hand inventory
 * @param {number} netRequirement Unfulfilled shortfall quantity
 * @returns {NetRequirement} Freshly allocated NetRequirement record
 */
function createNetRequirement(requirement, availableInventoryUsed, netRequirement) {
  return {
    demandSourceType: requirement.demandSourceType || "SALES_ORDER",
    salesOrderId: requirement.salesOrderId,
    salesOrderLineId: requirement.salesOrderLineId,
    itemId: requirement.itemId,
    grossRequirement: requirement.requiredQuantity,
    availableInventoryUsed,
    netRequirement,
    requiredDate: requirement.requiredDate instanceof Date
      ? new Date(requirement.requiredDate.getTime())
      : new Date(requirement.requiredDate),
    bomLevel: requirement.bomLevel,
    path: Array.isArray(requirement.path) ? [...requirement.path] : [],
  };
}

/**
 * Converts gross component requirements into net requirements by consuming available warehouse inventory.
 *
 * **Architectural Guarantees**:
 * - Upstream Invariant Assumption: Assumes `requiredQuantity > 0` has been validated upstream by `planning.validation.js` and `explodeBom()`.
 * - Chronological Priority: Preserves exact input requirement ordering (earlier demand consumes available stock first).
 * - Stateful Depletion: Inventory consumption is cumulative across the run. Once stock reaches 0, subsequent requirements receive `netRequirement = grossRequirement`.
 * - Full Demand Lineage: All traceability fields (`salesOrderId`, `salesOrderLineId`, `requiredDate`, `path`) are preserved on every output record.
 * - Input Immutability: Inputs (`explodedRequirements`, `inventory`) are never mutated.
 * - Output Isolation: Returned array and `NetRequirement` records are newly allocated.
 *
 * @param {ExplodedRequirement[]} explodedRequirements Gross requirements from explodeBom()
 * @param {InventoryRecord[]} [inventory] Current available warehouse inventory
 * @returns {NetRequirement[]} Net requirements array with stock allocations and net shortfalls
 */
function calculateInventoryNetting(explodedRequirements, inventory = []) {
  if (!Array.isArray(explodedRequirements) || explodedRequirements.length === 0) {
    return [];
  }

  const inventoryMap = createInventoryLookup(inventory);
  const results = [];

  for (let i = 0; i < explodedRequirements.length; i++) {
    const req = explodedRequirements[i];
    const grossRequirement = req.requiredQuantity;

    const { availableInventoryUsed, netRequirement } = consumeInventory(
      inventoryMap,
      req.itemId,
      grossRequirement
    );

    results.push(
      createNetRequirement(req, availableInventoryUsed, netRequirement)
    );
  }

  return results;
}

module.exports = {
  calculateInventoryNetting,
};
