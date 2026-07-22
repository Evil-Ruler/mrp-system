/**
 * Enterprise MRP System Safety Stock Planning Policy.
 *
 * Stage 2B Policy Module: Evaluates demand requirements and safety stock buffer deficits,
 * creating effective net requirements passed downstream to Stage 3 (Supply Allocation).
 */

/** @typedef {import("../../types/mrp.types").Item} Item */
/** @typedef {import("../../types/mrp.types").NetRequirement} NetRequirement */
/** @typedef {import("../../engine/inventoryNetting").InventoryRecord} InventoryRecord */

/**
 * Calculates shortage required strictly to satisfy customer sales demand.
 *
 * @param {number} grossRequirement Total gross required component quantity
 * @param {number} availableStock Warehouse inventory available before demand
 * @returns {number} Demand shortage quantity
 */
function calculateDemandRequirement(grossRequirement, availableStock) {
  const gross = typeof grossRequirement === "number" && grossRequirement > 0 ? grossRequirement : 0;
  const stock = typeof availableStock === "number" && availableStock > 0 ? availableStock : 0;
  return Math.max(0, gross - stock);
}

/**
 * Calculates safety stock buffer deficit required to restore stock to safetyStock level.
 *
 * @param {number} remainingStockAfterDemand Available inventory remaining after demand consumption
 * @param {number} safetyStock Configured item safety stock threshold
 * @returns {number} Safety stock buffer deficit quantity
 */
function calculateSafetyStockRequirement(remainingStockAfterDemand, safetyStock) {
  const stock = typeof remainingStockAfterDemand === "number" && remainingStockAfterDemand > 0 ? remainingStockAfterDemand : 0;
  const buffer = typeof safetyStock === "number" && safetyStock > 0 ? safetyStock : 0;
  return Math.max(0, buffer - stock);
}

/**
 * Calculates total effective net requirement by combining demand shortage and safety stock deficit.
 *
 * @param {number} demandRequirement Demand shortage
 * @param {number} safetyStockDeficit Safety stock deficit
 * @returns {number} Combined effective net requirement
 */
function calculateEffectiveNetRequirement(demandRequirement, safetyStockDeficit) {
  const req = typeof demandRequirement === "number" && demandRequirement > 0 ? demandRequirement : 0;
  const deficit = typeof safetyStockDeficit === "number" && safetyStockDeficit > 0 ? safetyStockDeficit : 0;
  return req + deficit;
}

/**
 * Applies Safety Stock Planning Policy to Net Requirements (Stage 2B).
 *
 * **Architectural & Business Guarantees**:
 * - Decoupled Pipeline Stage: Executes immediately after Inventory Netting (Stage 2A).
 * - Explicit Requirement Separation: Exposes `demandRequirement`, `safetyStockDeficit`, and `netRequirement` on every record.
 * - Proactive Replenishment: Evaluates all items with `safetyStock > 0`. If remaining stock after demand is below `safetyStock`, generates a safety stock replenishment net requirement even if zero sales order demand lines exist.
 * - Input Immutability: Inputs are never mutated.
 *
 * @param {NetRequirement[]} netRequirements Output from Stage 2A Inventory Netting
 * @param {InventoryRecord[]} [inventory] Current warehouse inventory records
 * @param {Item[]} [items] Item master planning DTO records
 * @returns {NetRequirement[]} Augmented NetRequirement array with effective net requirements and safetyStockDeficit
 */
function applySafetyStockPolicy(netRequirements = [], inventory = [], items = []) {
  const itemMap = new Map();
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && typeof item.itemId === "number") {
        itemMap.set(item.itemId, item);
      }
    }
  }

  // Build stock balance map per itemId
  const stockMap = new Map();
  if (Array.isArray(inventory)) {
    for (let i = 0; i < inventory.length; i++) {
      const rec = inventory[i];
      if (rec && typeof rec.itemId === "number" && typeof rec.availableQuantity === "number") {
        const cur = stockMap.get(rec.itemId) || 0;
        stockMap.set(rec.itemId, Math.max(0, cur + rec.availableQuantity));
      }
    }
  }

  // Track demand consumed per item
  const demandConsumedMap = new Map();
  const results = [];
  const processedDemandItemIds = new Set();

  if (Array.isArray(netRequirements)) {
    for (let i = 0; i < netRequirements.length; i++) {
      const req = netRequirements[i];
      const item = itemMap.get(req.itemId);
      const safetyStock = item && typeof item.safetyStock === "number" && item.safetyStock > 0 ? item.safetyStock : 0;

      const initialStock = stockMap.get(req.itemId) || 0;
      const prevConsumed = demandConsumedMap.get(req.itemId) || 0;
      const totalDemandSoFar = prevConsumed + req.grossRequirement;

      // Available stock remaining for this requirement line before safety stock check
      const stockBeforeThisLine = Math.max(0, initialStock - prevConsumed);
      const demandReq = calculateDemandRequirement(req.grossRequirement, stockBeforeThisLine);
      const stockAfterDemand = Math.max(0, stockBeforeThisLine - req.grossRequirement);

      demandConsumedMap.set(req.itemId, totalDemandSoFar);
      processedDemandItemIds.add(req.itemId);

      // Check safety stock deficit for this item
      let safetyDeficit = 0;
      if (safetyStock > 0) {
        safetyDeficit = calculateSafetyStockRequirement(stockAfterDemand, safetyStock);
      }

      const effectiveNet = calculateEffectiveNetRequirement(demandReq, safetyDeficit);

      results.push({
        ...req,
        demandRequirement: demandReq,
        safetyStockDeficit: safetyDeficit,
        netRequirement: effectiveNet,
      });

      // Once safety stock deficit is accounted for in an item's requirement, reset safety stock deficit for subsequent lines of same item
      if (safetyDeficit > 0) {
        // Decrement remaining effective buffer
        stockMap.set(req.itemId, initialStock + safetyDeficit);
      }
    }
  }

  // Check for Proactive Replenishment on Zero-Demand Items with safetyStock > 0
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item.itemId !== "number" || processedDemandItemIds.has(item.itemId)) {
        continue;
      }

      const safetyStock = typeof item.safetyStock === "number" && item.safetyStock > 0 ? item.safetyStock : 0;
      if (safetyStock <= 0) {
        continue;
      }

      const availableStock = stockMap.get(item.itemId) || 0;
      const safetyDeficit = calculateSafetyStockRequirement(availableStock, safetyStock);

      if (safetyDeficit > 0) {
        results.push({
          demandSourceType: "SALES_ORDER",
          salesOrderId: "SAFETY_STOCK_REPLENISHMENT",
          salesOrderLineId: 0,
          itemId: item.itemId,
          grossRequirement: 0,
          availableInventoryUsed: Math.min(availableStock, safetyStock),
          demandRequirement: 0,
          safetyStockDeficit: safetyDeficit,
          netRequirement: safetyDeficit,
          requiredDate: new Date(),
          bomLevel: 0,
          path: [item.itemId],
        });
      }
    }
  }

  return results;
}

module.exports = {
  calculateDemandRequirement,
  calculateSafetyStockRequirement,
  calculateEffectiveNetRequirement,
  applySafetyStockPolicy,
};
