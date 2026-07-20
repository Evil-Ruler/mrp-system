const repository = require("../repositories/mrp.repository");
const { ALLOWED_DEMAND_STATUSES } = require("../constants/planning.constants");
const {
  validateItems,
  validateDemand,
  validateBom,
  sortDemand,
} = require("../validation/planning.validation");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */
/** @typedef {import("../types/mrp.types").Item} Item */

class MRPService {
  /**
   * Loads and validates planning dataset containing demand, items, and BOM structures.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<{demand: Demand[], bom: {headers: BomHeader[], lines: BomLine[]}, items: Item[]}>}
   */
  async getPlanningData(filters = {}) {
    const demand = await repository.getDemandOrderLines({
      ...filters,
      statuses: ALLOWED_DEMAND_STATUSES,
    });

    // Avoid loading items and BOM datasets if no eligible demand exists.
    if (!demand || demand.length === 0) {
      return {
        demand: [],
        bom: {
          headers: [],
          lines: [],
        },
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
   * @deprecated
   * Maintained for Phase 1 compatibility.
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
