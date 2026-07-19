const prisma = require("../../lib/prisma");
const { DataAccessError } = require("../errors/mrp.errors");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */
/** @typedef {import("../types/mrp.types").Item} Item */

function normalizeStatuses(statuses) {
  return statuses.map((status) => String(status).trim()).filter(Boolean);
}

function buildSalesOrderWhere(filters) {
  const statuses = Array.isArray(filters.statuses) ? normalizeStatuses(filters.statuses) : [];

  const salesOrderWhere = {};

  if (statuses.length > 0) {
    salesOrderWhere.status = {
      in: statuses,
    };
  }

  if (Array.isArray(filters.salesOrderIds) && filters.salesOrderIds.length > 0) {
    salesOrderWhere.salesOrderId = {
      in: filters.salesOrderIds,
    };
  }

  if (filters.requiredDateFrom || filters.requiredDateTo) {
    salesOrderWhere.orderDate = {};

    if (filters.requiredDateFrom) {
      salesOrderWhere.orderDate.gte = new Date(filters.requiredDateFrom);
    }

    if (filters.requiredDateTo) {
      salesOrderWhere.orderDate.lte = new Date(filters.requiredDateTo);
    }
  }

  return salesOrderWhere;
}

function toDemandDomain(line) {
  // Derived identifier (not stored in the database).
  return {
    demandId: `${line.salesOrderId}:${line.salesOrderLineId}`,
    salesOrderId: line.salesOrderId,
    salesOrderLineId: line.salesOrderLineId,
    itemId: line.productId,
    quantity: line.quantity,
    requiredDate: line.salesOrder.orderDate,
    uom: line.product.uom,
  };
}

function toBomHeaderDomain(header) {
  return {
    bomHeaderId: header.bomId,
    parentItemId: header.finishedGoodId,
  };
}

function toBomLineDomain(header, line) {
  return {
    bomLineId: line.bomLineId,
    bomHeaderId: line.bomId,
    parentItemId: header.finishedGoodId,
    childItemId: line.materialId,
    qtyPerParent: line.quantityRequired,
  };
}

function toItemDomain(item) {
  return {
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemType: item.category,
    baseUom: item.uom,
  };
}

/**
 * Repository for reading MRP data.
 */
class MRPRepository {
  /**
   * Returns sales order demand lines.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<Demand[]>}
   * @throws {DataAccessError}
   */
  async getDemandOrderLines(filters = {}) {
    const salesOrderWhere = buildSalesOrderWhere(filters);
    const where = {
      salesOrder: salesOrderWhere,
    };

    try {
      const demandLines = await prisma.salesOrderLine.findMany({
        where,
        select: {
          salesOrderLineId: true,
          salesOrderId: true,
          productId: true,
          quantity: true,
          product: {
            select: {
              itemId: true,
              uom: true,
            },
          },
          salesOrder: {
            select: {
              salesOrderId: true,
              orderDate: true,
              status: true,
            },
          },
        },
      });

      return demandLines.map(toDemandDomain);
    } catch (error) {
      throw new DataAccessError("Failed to load demand order lines for MRP.", error);
    }
  }

  /**
   * Returns BOM headers and lines.
   *
   * @returns {Promise<{headers: BomHeader[], lines: BomLine[]}>}
   * @throws {DataAccessError}
   */
  async getBomData() {
    try {
      const bomHeaders = await prisma.bOMHeader.findMany({
        select: {
          bomId: true,
          finishedGoodId: true,
          bomLines: {
            select: {
              bomLineId: true,
              bomId: true,
              materialId: true,
              quantityRequired: true,
            },
          },
        },
      });

      const headers = bomHeaders.map(toBomHeaderDomain);
      const lines = bomHeaders.flatMap((header) =>
        header.bomLines.map((line) => toBomLineDomain(header, line))
      );

      return {
        headers,
        lines,
      };
    } catch (error) {
      throw new DataAccessError("Failed to load BOM headers and BOM lines for MRP.", error);
    }
  }

  /**
   * Returns item master records.
   *
   * @returns {Promise<Item[]>}
   * @throws {DataAccessError}
   */
  async getItems() {
    try {
      const items = await prisma.item.findMany({
        select: {
          itemId: true,
          itemCode: true,
          category: true,
          uom: true,
        },
      });

      return items.map(toItemDomain);
    } catch (error) {
      throw new DataAccessError("Failed to load item master records for MRP.", error);
    }
  }
}

module.exports = new MRPRepository();
