const { ValidationError } = require("../errors/mrp.errors");
const { calculateInventoryNetting } = require("./inventoryNetting");
const { applySafetyStockPolicy } = require("../policies/safetyStock/safetyStockPolicy");
const { allocateSupply } = require("./supplyAllocation");
const { generateRecommendations } = require("./recommendationGenerator");
const { createBomLineLookup, buildChildRequirements } = require("./childRequirementBuilder");

function createRemainingInventory(inventory) {
  const remaining = new Map();
  for (const record of Array.isArray(inventory) ? inventory : []) {
    if (!record || typeof record.itemId !== "number" || typeof record.availableQuantity !== "number") {
      continue;
    }
    remaining.set(record.itemId, Math.max(0, (remaining.get(record.itemId) || 0) + record.availableQuantity));
  }
  return remaining;
}

function cloneSupply(supply) {
  return (Array.isArray(supply) ? supply : [])
    .filter((record) => record && typeof record.itemId === "number")
    .map((record) => ({
      ...record,
      openQuantity: typeof record.openQuantity === "number"
        ? record.openQuantity
        : (typeof record.quantity === "number" ? record.quantity : 0),
      expectedDate: record.expectedDate instanceof Date
        ? new Date(record.expectedDate.getTime())
        : new Date(record.expectedDate),
    }));
}

function inventorySnapshot(remainingInventory) {
  return Array.from(remainingInventory, ([itemId, availableQuantity]) => ({ itemId, availableQuantity }));
}

function supplySnapshot(remainingSupply) {
  return remainingSupply.map((record) => ({
    ...record,
    expectedDate: new Date(record.expectedDate.getTime()),
  }));
}

function consumeSupply(records, itemId, requiredDate, quantity) {
  if (quantity <= 0) {
    return;
  }

  const targetTime = requiredDate.getTime();
  const eligible = records
    .filter((record) => record.itemId === itemId && record.openQuantity > 0 && record.expectedDate.getTime() <= targetTime)
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());

  let remaining = quantity;
  for (const record of eligible) {
    if (remaining <= 0) {
      break;
    }
    const used = Math.min(record.openQuantity, remaining);
    record.openQuantity -= used;
    remaining -= used;
  }

  if (remaining > 1e-9) {
    throw new ValidationError("Supply allocation state could not be reconciled with the allocation result.");
  }
}

function createTraversalState(context) {
  return {
    remainingInventory: createRemainingInventory(context.inventory),
    remainingPurchaseSupply: cloneSupply(context.purchaseOrders),
    remainingProductionSupply: cloneSupply(context.productionOrders),
    explodedRequirements: [],
    netRequirements: [],
    allocatedRequirements: [],
    recommendations: [],
  };
}

function assertNotCyclic(requirement) {
  const path = Array.isArray(requirement.path) ? requirement.path : [];
  const occurrences = path.filter((itemId) => itemId === requirement.itemId).length;
  if (occurrences > 1) {
    throw new ValidationError(`Cyclic BOM dependency detected for item ${requirement.itemId}.`);
  }
}

/**
 * Executes the V1 planned-order-driven recursive traversal. Existing policy modules
 * are called unchanged; this module owns only recursion-local remaining quantities.
 *
 * @param {{demand: Object[], bom: Object, items: Object[], inventory: Object[], purchaseOrders: Object[], productionOrders: Object[], planningDate: Date}} context
 * @param {{maxResults?: number}} [options]
 * @returns {{explodedRequirements: Object[], netRequirements: Object[], allocatedRequirements: Object[], recommendations: Object[]}}
 */
function traversePlannedOrders(context, options = {}) {
  const state = createTraversalState(context);
  const bomLineLookup = createBomLineLookup(context.bom);
  const maxResults = typeof options.maxResults === "number" ? options.maxResults : Infinity;

  function processRequirement(requirement) {
    assertNotCyclic(requirement);
    if (state.explodedRequirements.length >= maxResults) {
      throw new ValidationError(`Planned-order traversal exceeded the maximum of ${maxResults} requirements.`);
    }

    state.explodedRequirements.push({
      ...requirement,
      requiredDate: new Date(requirement.requiredDate.getTime()),
      path: [...requirement.path],
    });

    const currentInventory = inventorySnapshot(state.remainingInventory);
    const netRequirement = calculateInventoryNetting([requirement], currentInventory)[0];
    state.remainingInventory.set(
      requirement.itemId,
      Math.max(0, (state.remainingInventory.get(requirement.itemId) || 0) - netRequirement.availableInventoryUsed)
    );

    const safetyRequirement = applySafetyStockPolicy([netRequirement], currentInventory, context.items)[0];
    if (safetyRequirement.safetyStockDeficit > 0) {
      state.remainingInventory.set(
        requirement.itemId,
        (state.remainingInventory.get(requirement.itemId) || 0) + safetyRequirement.safetyStockDeficit
      );
    }
    state.netRequirements.push(safetyRequirement);

    const allocatedRequirement = allocateSupply(
      [safetyRequirement],
      supplySnapshot(state.remainingPurchaseSupply),
      supplySnapshot(state.remainingProductionSupply)
    )[0];
    consumeSupply(
      state.remainingPurchaseSupply,
      requirement.itemId,
      allocatedRequirement.requiredDate,
      allocatedRequirement.purchaseSupplyUsed
    );
    consumeSupply(
      state.remainingProductionSupply,
      requirement.itemId,
      allocatedRequirement.requiredDate,
      allocatedRequirement.productionSupplyUsed
    );
    state.allocatedRequirements.push(allocatedRequirement);

    const generated = generateRecommendations([allocatedRequirement], context.items, context.planningDate);
    for (const recommendation of generated) {
      state.recommendations.push(recommendation);
      if (recommendation.recommendationType !== "PRODUCTION") {
        continue;
      }

      const children = buildChildRequirements(recommendation, bomLineLookup);
      for (const child of children) {
        processRequirement(child);
      }
    }
  }

  for (const demand of context.demand) {
    processRequirement({
      demandSourceType: "SALES_ORDER",
      salesOrderId: demand.salesOrderId,
      salesOrderLineId: demand.salesOrderLineId,
      itemId: demand.itemId,
      requiredQuantity: demand.quantity,
      requiredDate: demand.requiredDate instanceof Date ? new Date(demand.requiredDate.getTime()) : new Date(demand.requiredDate),
      bomLevel: 0,
      path: [demand.itemId],
    });
  }

  return {
    explodedRequirements: state.explodedRequirements,
    netRequirements: state.netRequirements,
    allocatedRequirements: state.allocatedRequirements,
    recommendations: state.recommendations,
  };
}

module.exports = {
  traversePlannedOrders,
};
