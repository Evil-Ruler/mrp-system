/**
 * Enterprise MRP System Domain Type Definitions.
 *
 * Declarative JSDoc domain contract consumed across MRP engine pipeline stages:
 * - Data Repository (mrp.repository.js)
 * - Input Validation (planning.validation.js)
 * - Stage 1: BOM Explosion (bomExplosion.js)
 * - Stage 2: Inventory Netting (inventoryNetting.js)
 * - Stage 3: Supply Allocation (supplyAllocation.js)
 * - Stage 4: Recommendation Generation (recommendationGenerator.js)
 * - Service Orchestration (mrp.service.js)
 */

// ============================================================================
// PRIMITIVE DOMAIN ALIASES
// ============================================================================

/** @typedef {number} ItemId Unique numerical identifier for an item master record */
/** @typedef {string} BomHeaderId Unique identifier for a Bill of Materials header */
/** @typedef {number} BomLineId Unique identifier for a specific BOM component line */
/** @typedef {string} SalesOrderId Unique identifier for a customer sales order */
/** @typedef {number} SalesOrderLineId Line item sequence number within a sales order */
/** @typedef {string} DemandId Synthetic composite key uniquely identifying a sales demand line (SO:Line) */
/** @typedef {number} Quantity Non-negative numerical quantity measurement */
/** @typedef {string} UnitOfMeasure Standard unit of measure code (e.g. PCS, KG, MTR) */
/** @typedef {Date} RequiredDate Date by which demand or component requirement must be fulfilled */
/** @typedef {"PURCHASE"|"PRODUCTION"} ProcurementType Fulfill strategy for component supply */
/** @typedef {"SALES_ORDER"} DemandSourceType Upstream source origin of planning demand */

// ============================================================================
// CORE DATASET DOMAIN MODELS
// ============================================================================

/**
 * Customer sales order demand line consuming finished goods stock.
 *
 * @typedef {Object} Demand
 * @property {DemandId} demandId Synthetic composite identifier (SO:Line)
 * @property {SalesOrderId} salesOrderId Customer sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Sales order line item sequence
 * @property {ItemId} itemId Demanded finished good item ID
 * @property {Quantity} quantity Demanded order quantity
 * @property {RequiredDate} requiredDate Delivery due date requested by customer
 * @property {UnitOfMeasure} uom Unit of measure
 */

/**
 * Bill of Materials (BOM) header record linking a parent item to its component structure.
 *
 * @typedef {Object} BomHeader
 * @property {BomHeaderId} bomHeaderId BOM structure header identifier
 * @property {ItemId} parentItemId Parent finished good or sub-assembly item ID
 */

/**
 * Bill of Materials (BOM) component line defining single-level child usage rates.
 *
 * @typedef {Object} BomLine
 * @property {BomLineId} bomLineId BOM line item identifier
 * @property {BomHeaderId} bomHeaderId Parent BOM header identifier
 * @property {ItemId} parentItemId Parent finished good or sub-assembly item ID
 * @property {ItemId} childItemId Child component or raw material item ID
 * @property {Quantity} qtyPerParent Usage multiplier required to produce 1 unit of parent
 */

/**
 * Item Master record containing inventory catalog and procurement configuration.
 *
 * @typedef {Object} Item
 * @property {ItemId} itemId Item master record identifier
 * @property {string} itemCode Unique alphanumeric SKU item code
 * @property {string} itemType Item category classification (e.g. FINISHED_GOOD, SUB_ASSEMBLY, RAW_MATERIAL)
 * @property {ProcurementType} [procurementType] Optional explicit fulfillment strategy ("PURCHASE" vs "PRODUCTION").
 *                                                If omitted in schema, derived dynamically by engine from itemType.
 * @property {UnitOfMeasure} baseUom Standard stocking unit of measure
 */

// ============================================================================
// MRP ENGINE PIPELINE INTERMEDIATE CONTRACTS
// ============================================================================

/**
 * Gross component requirement generated during Stage 1 (BOM Explosion).
 *
 * @typedef {Object} ExplodedRequirement
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Customer sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Sales order line item sequence
 * @property {ItemId} itemId Component item ID requiring supply
 * @property {Quantity} requiredQuantity Total gross quantity required
 * @property {RequiredDate} requiredDate Date requirement is needed
 * @property {number} bomLevel Tree depth in BOM hierarchy (0 = Finished Good, 1 = Sub-assembly, etc.)
 * @property {number[]} path Traversal ancestor item path preventing cyclic loops
 */

/**
 * Net component shortfall derived during Stage 2 (Inventory Netting).
 * Calculated as: netRequirement = grossRequirement - availableInventoryUsed.
 *
 * @typedef {Object} NetRequirement
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Customer sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Sales order line item sequence
 * @property {ItemId} itemId Component item ID
 * @property {Quantity} grossRequirement Total gross quantity required before stock netting (Stage 1 output)
 * @property {Quantity} availableInventoryUsed On-hand warehouse stock consumed (Stage 2 output)
 * @property {Quantity} netRequirement Unfulfilled shortfall after inventory netting (Stage 2 output)
 * @property {RequiredDate} requiredDate Date requirement is needed
 * @property {number} bomLevel Tree depth in BOM hierarchy
 * @property {number[]} path Traversal ancestor item path
 */

/**
 * Requirement allocated against open purchase/production supply during Stage 3 (Supply Allocation).
 * Calculated as: remainingShortage = netRequirement - (purchaseSupplyUsed + productionSupplyUsed).
 *
 * @typedef {Object} AllocatedRequirement
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Customer sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Sales order line item sequence
 * @property {ItemId} itemId Component item ID
 * @property {Quantity} grossRequirement Total gross quantity required (Stage 1 output)
 * @property {Quantity} availableInventoryUsed Warehouse inventory stock consumed (Stage 2 output)
 * @property {Quantity} netRequirement Net shortfall before open supply allocation (Stage 2 output)
 * @property {Quantity} purchaseSupplyUsed Allocated open Purchase Order quantity (Stage 3 output)
 * @property {Quantity} productionSupplyUsed Allocated open Production Order quantity (Stage 3 output)
 * @property {Quantity} remainingShortage Remaining unfulfilled shortage requiring action (Stage 3 output)
 * @property {RequiredDate} requiredDate Date requirement is needed
 * @property {number} bomLevel Tree depth in BOM hierarchy
 * @property {number[]} path Traversal ancestor item path
 */

/**
 * Final action recommendation produced during Stage 4 (Recommendation Generation).
 *
 * @typedef {Object} Recommendation
 * @property {ProcurementType} recommendationType Action strategy ("PURCHASE" or "PRODUCTION")
 * @property {ItemId} itemId Item requiring procurement or manufacturing
 * @property {Quantity} quantity Recommended order quantity
 * @property {RequiredDate} requiredDate Date order must be available
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Upstream sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Upstream sales order line item sequence
 * @property {number} bomLevel Tree depth in BOM hierarchy
 * @property {number[]} path Traversal ancestor item path
 */

module.exports = {};
