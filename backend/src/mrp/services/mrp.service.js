const repository = require("../repositories/mrp.repository");
const { ALLOWED_DEMAND_STATUSES, MAX_EXPLODED_REQUIREMENTS } = require("../constants/planning.constants");
const {
  validateItems,
  validateDemand,
  validateBom,
  sortDemand,
} = require("../validation/planning.validation");
const { createInventorySnapshot } = require("../engine/inventorySnapshot");
const { traversePlannedOrders } = require("../engine/plannedOrderTraversal");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../engine/bomExplosion").ExplodedRequirement} ExplodedRequirement */
/** @typedef {import("../engine/inventoryNetting").NetRequirement} NetRequirement */
/** @typedef {import("../engine/supplyAllocation").AllocatedRequirement} AllocatedRequirement */
/** @typedef {import("../engine/recommendationGenerator").Recommendation} Recommendation */

/**
 * @typedef {Object} PlanningSummary
 * @property {number} salesOrderCount
 * @property {number} explodedRequirementCount
 * @property {number} netRequirementCount
 * @property {number} allocatedRequirementCount
 * @property {number} recommendationCount
 * @property {number} purchaseRecommendationCount
 * @property {number} productionRecommendationCount
 * @property {number} totalShortageQuantity
 */

/**
 * @typedef {Object} PlanningResult
 * @property {Date} planningDate
 * @property {Demand[]} salesOrders
 * @property {ExplodedRequirement[]} explodedRequirements
 * @property {NetRequirement[]} netRequirements
 * @property {AllocatedRequirement[]} allocatedRequirements
 * @property {Recommendation[]} recommendations
 * @property {PlanningSummary} summary
 */

class MRPService {
  /**
   * Loads all required datasets for the planning run from repository sources.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @private
   */
  async _loadPlanningData(filters = {}) {
    const demand = await repository.getDemandOrderLines({
      ...filters,
      statuses: ALLOWED_DEMAND_STATUSES,
    });

    if (!demand || demand.length === 0) {
      return null;
    }

    // These loads have no interdependencies, so they run concurrently.
    // The invocation order is preserved to keep loading deterministic.
    const [items, bom, inventory, purchaseOrders, productionOrders] = await Promise.all([
      repository.getItems(),
      repository.getBomData(),
      typeof repository.getInventory === "function" ? repository.getInventory() : Promise.resolve([]),
      typeof repository.getOpenPurchaseOrders === "function" ? repository.getOpenPurchaseOrders() : Promise.resolve([]),
      typeof repository.getOpenProductionOrders === "function" ? repository.getOpenProductionOrders() : Promise.resolve([]),
    ]);

    return {
      demand,
      items,
      bom,
      inventory,
      purchaseOrders,
      productionOrders,
    };
  }

  /**
   * Computes statistical metrics summarizing the results of an MRP planning run.
   *
   * @param {Demand[]} salesOrders
   * @param {ExplodedRequirement[]} explodedRequirements
   * @param {NetRequirement[]} netRequirements
   * @param {AllocatedRequirement[]} allocatedRequirements
   * @param {Recommendation[]} recommendations
   * @returns {PlanningSummary}
   * @private
   */
  _buildPlanningSummary(
    salesOrders,
    explodedRequirements,
    netRequirements,
    allocatedRequirements,
    recommendations
  ) {
    const purchaseRecs = recommendations.filter((r) => r.recommendationType === "PURCHASE").length;
    const productionRecs = recommendations.filter((r) => r.recommendationType === "PRODUCTION").length;
    const totalShortageQuantity = recommendations.reduce((sum, r) => sum + (r.quantity || 0), 0);

    return {
      salesOrderCount: salesOrders.length,
      explodedRequirementCount: explodedRequirements.length,
      netRequirementCount: netRequirements.length,
      allocatedRequirementCount: allocatedRequirements.length,
      recommendationCount: recommendations.length,
      purchaseRecommendationCount: purchaseRecs,
      productionRecommendationCount: productionRecs,
      totalShortageQuantity,
    };
  }

  /**
   * Orchestrates the complete MRP planning engine pipeline:
   * Data Loading -> Validation -> Planned Order Traversal -> Recommendation Generation.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<PlanningResult>} Structured MRP planning execution result
   */
  async runPlanning(filters = {}) {
    const planningDate = new Date();
    const rawData = await this._loadPlanningData(filters);

    if (!rawData) {
      const emptySummary = this._buildPlanningSummary([], [], [], [], []);
      return {
        planningDate,
        salesOrders: [],
        explodedRequirements: [],
        netRequirements: [],
        allocatedRequirements: [],
        recommendations: [],
        summary: emptySummary,
      };
    }

    const { demand, items, bom, inventory, purchaseOrders, productionOrders } = rawData;

    // Step 2: Pure Invariant Validation
    validateItems(rawData.items);
    validateDemand(rawData.demand);
    validateBom(rawData.bom, rawData.demand, rawData.items);

    // Step 3: Planning Context Construction Stage
    const context = this._buildPlanningContext(rawData, planningDate);

    // Step 4: Planned-order-driven traversal. Components are created only when
    // their parent production recommendation survives all netting and policies.
    const {
      explodedRequirements,
      netRequirements,
      allocatedRequirements,
      recommendations,
    } = traversePlannedOrders(context, { maxResults: MAX_EXPLODED_REQUIREMENTS });

    // Step 8: Planning Summary Assembly & Structured Output
    const summary = this._buildPlanningSummary(
      context.demand,
      explodedRequirements,
      netRequirements,
      allocatedRequirements,
      recommendations
    );

    return {
      planningDate: context.planningDate,
      salesOrders: context.demand,
      explodedRequirements,
      netRequirements,
      allocatedRequirements,
      recommendations,
      summary,
    };
  }

  /**
   * Assembles an immutable PlanningContext value object for an execution run.
   *
   * @param {Object} rawData Raw loaded dataset
   * @param {Date} planningDate Execution run date
   * @returns {import("../types/mrp.types").PlanningContext} Immutable planning context
   */
  _buildPlanningContext(rawData, planningDate) {
    const { demand, items, bom, inventory, purchaseOrders, productionOrders } = rawData || {};
    const sortedDemand = sortDemand(demand || []);
    const inventorySnapshot = createInventorySnapshot(inventory || []);

    return Object.freeze({
      planningDate,
      demand: sortedDemand,
      items: Array.isArray(items) ? Object.freeze([...items]) : [],
      bom: bom || { headers: [], lines: [] },
      inventory: Array.isArray(inventory) ? Object.freeze([...inventory]) : [],
      purchaseOrders: Array.isArray(purchaseOrders) ? Object.freeze([...purchaseOrders]) : [],
      productionOrders: Array.isArray(productionOrders) ? Object.freeze([...productionOrders]) : [],
      inventorySnapshot,
    });
  }

  /**
   * Loads and validates raw planning dataset (Phase 2 compatibility wrapper).
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<{demand: Demand[], bom: {headers: BomHeader[], lines: BomLine[]}, items: Item[]}>}
   */
  async getPlanningData(filters = {}) {
    const demand = await repository.getDemandOrderLines({
      ...filters,
      statuses: ALLOWED_DEMAND_STATUSES,
    });

    if (!demand || demand.length === 0) {
      return {
        demand: [],
        bom: { headers: [], lines: [] },
        items: [],
      };
    }

    const items = await repository.getItems();
    validateItems(items);
    validateDemand(demand);

    const bom = await repository.getBomData();
    validateBom(bom, demand, items);

    const sortedDemand = sortDemand(demand);

    return {
      demand: sortedDemand,
      bom,
      items,
    };
  }

  /**
   * @deprecated Maintained for Phase 1 compatibility.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<Demand[]>}
   */
  getAllSalesOrders(filters = {}) {
    return repository.getDemandOrderLines({
      ...filters,
      statuses: ALLOWED_DEMAND_STATUSES,
    });
  }
}

module.exports = new MRPService();
