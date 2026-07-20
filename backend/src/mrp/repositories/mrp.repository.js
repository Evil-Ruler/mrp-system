const prisma = require("../../lib/prisma");
const { DataAccessError } = require("../errors/mrp.errors");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../engine/inventoryNetting").InventoryRecord} InventoryRecord */
/** @typedef {import("../engine/supplyAllocation").SupplyRecord} SupplyRecord */

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

/**
 * Pure domain mapper for Sales Order demand lines.
 */
function toDemandDomain(line) {
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

/**
 * Pure domain mapper for BOM Header records.
 */
function toBomHeaderDomain(header) {
  return {
    bomHeaderId: header.bomId,
    parentItemId: header.finishedGoodId,
  };
}

/**
 * Pure domain mapper for BOM Line records.
 */
function toBomLineDomain(header, line) {
  return {
    bomLineId: line.bomLineId,
    bomHeaderId: line.bomId,
    parentItemId: header.finishedGoodId,
    childItemId: line.materialId,
    qtyPerParent: line.quantityRequired,
  };
}

/**
 * Pure domain mapper for Item Master records.
 * Maps database Item entity to domain Item object without inferring business rules.
 */
function toItemDomain(item) {
  const domainItem = {
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemType: item.category,
    baseUom: item.uom,
  };

  if (typeof item.procurementType === "string") {
    domainItem.procurementType = item.procurementType;
  }

  return domainItem;
}

/**
 * Pure domain mapper for warehouse inventory stock balances.
 */
function toInventoryDomain(item) {
  return {
    itemId: item.itemId,
    availableQuantity: item.currentStock || 0,
  };
}

/**
 * Pure domain mapper for open Purchase Order lines.
 *
 * **Schema Limitation Assumption**: Maps `orderDate` as `expectedDate` for MRP supply allocation
 * until an explicit `expectedDeliveryDate` column is added to database schema.
 */
function toPurchaseSupplyDomain(line) {
  return {
    purchaseOrderId: line.purchaseOrderId,
    itemId: line.materialId,
    openQuantity: line.quantity,
    expectedDate: line.purchaseOrder.orderDate,
  };
}

/**
 * Pure domain mapper for open Production Orders.
 *
 * **Schema Limitation Assumption**: Maps `startDate` as `expectedDate` for MRP supply allocation
 * until an explicit `plannedCompletionDate` column is added to database schema.
 */
function toProductionSupplyDomain(mo) {
  return {
    productionOrderId: mo.productionOrderId,
    itemId: mo.productId,
    openQuantity: mo.quantity,
    expectedDate: mo.startDate,
  };
}

/**
 * Production-ready Repository for reading MRP data via Prisma ORM.
 * Strictly decoupled from planning algorithms, validation rules, or business calculations.
 */
class MRPRepository {
  /**
   * Queries open sales order demand lines from database.
   *
   * @param {{salesOrderIds?: string[], statuses?: string[], requiredDateFrom?: string|Date, requiredDateTo?: string|Date}} [filters]
   * @returns {Promise<Demand[]>} Array of pure Demand domain objects
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getDemandOrderLines(filters = {}) {
    const salesOrderWhere = buildSalesOrderWhere(filters);
    const where = {
      salesOrder: salesOrderWhere,
    };

    try {
      const demandLines = await prisma.salesOrderLine.findMany({
        where,
        orderBy: [
          { salesOrder: { orderDate: "asc" } },
          { salesOrderId: "asc" },
          { salesOrderLineId: "asc" },
        ],
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
   * Queries BOM headers and BOM line structures from database.
   *
   * @returns {Promise<{headers: BomHeader[], lines: BomLine[]}>} Pure BOM Header and Line domain collections
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getBomData() {
    try {
      const bomHeaders = await prisma.bOMHeader.findMany({
        orderBy: [
          { finishedGoodId: "asc" },
          { bomId: "asc" },
        ],
        select: {
          bomId: true,
          finishedGoodId: true,
          bomLines: {
            orderBy: [
              { bomLineId: "asc" },
            ],
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
   * Queries item master records from database.
   *
   * @returns {Promise<Item[]>} Array of pure Item Master domain objects
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getItems() {
    try {
      const items = await prisma.item.findMany({
        orderBy: {
          itemId: "asc",
        },
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

  /**
   * Queries current available warehouse stock balances per item.
   *
   * @returns {Promise<InventoryRecord[]>} Array of pure InventoryRecord domain objects
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getInventory() {
    try {
      const items = await prisma.item.findMany({
        orderBy: {
          itemId: "asc",
        },
        select: {
          itemId: true,
          currentStock: true,
        },
      });

      return items.map(toInventoryDomain);
    } catch (error) {
      throw new DataAccessError("Failed to load warehouse inventory for MRP.", error);
    }
  }

  /**
   * Queries open purchase orders from database.
   *
   * @returns {Promise<SupplyRecord[]>} Array of pure Purchase Order SupplyRecord domain objects
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getOpenPurchaseOrders() {
    try {
      const poLines = await prisma.purchaseOrderLine.findMany({
        where: {
          purchaseOrder: {
            status: { in: ["OPEN", "RELEASED", "APPROVED", "CONFIRMED"] },
          },
        },
        orderBy: [
          { purchaseOrder: { orderDate: "asc" } },
          { purchaseOrderId: "asc" },
          { purchaseOrderLineId: "asc" },
        ],
        select: {
          purchaseOrderId: true,
          materialId: true,
          quantity: true,
          purchaseOrder: {
            select: {
              orderDate: true,
            },
          },
        },
      });

      return poLines.map(toPurchaseSupplyDomain);
    } catch (error) {
      throw new DataAccessError("Failed to load open purchase orders for MRP.", error);
    }
  }

  /**
   * Queries open production orders from database.
   *
   * @returns {Promise<SupplyRecord[]>} Array of pure Production Order SupplyRecord domain objects
   * @throws {DataAccessError} Wrapped Prisma data access error
   */
  async getOpenProductionOrders() {
    try {
      const moList = await prisma.productionOrder.findMany({
        where: {
          status: { in: ["OPEN", "RELEASED", "IN_PROGRESS", "PLANNED"] },
        },
        orderBy: [
          { startDate: "asc" },
          { productionOrderId: "asc" },
        ],
        select: {
          productionOrderId: true,
          productId: true,
          quantity: true,
          startDate: true,
        },
      });

      return moList.map(toProductionSupplyDomain);
    } catch (error) {
      throw new DataAccessError("Failed to load open production orders for MRP.", error);
    }
  }
}

module.exports = new MRPRepository();
