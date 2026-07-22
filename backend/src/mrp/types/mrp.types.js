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

/** @typedef {"L4L"|"FOQ"|"MOQ"|"ORDER_MULTIPLE"} LotSizingPolicy Configured lot sizing strategy key */

/**
 * Item Master Planning DTO consumed by planning validation and MRP engine.
 *
 * @typedef {Object} Item
 * @property {ItemId} itemId Unique numerical identifier for item master record
 * @property {string} itemCode Unique alphanumeric SKU item code
 * @property {ProcurementType} procurementType Policy strategy ("PURCHASE" or "PRODUCTION")
 * @property {UnitOfMeasure} baseUom Standard stocking unit of measure
 * @property {LotSizingPolicy} [lotSizingPolicy="L4L"] Lot sizing policy strategy key
 * @property {number} [fixedOrderQuantity] Fixed order quantity (for FOQ)
 * @property {number} [minimumOrderQuantity] Minimum order quantity threshold (for MOQ)
 * @property {number} [orderMultiple] Order quantity rounding multiple (for ORDER_MULTIPLE)
 * @property {number} [purchaseLeadTimeDays=0] Purchase lead time in calendar days (for PURCHASE items)
 * @property {number} [manufacturingLeadTimeDays=0] In-house manufacturing lead time in calendar days (for PRODUCTION items)
 * @property {number} [safetyStock=0] Fixed safety stock buffer threshold
 * @property {number} [maxOrderQuantity] Maximum single order batch size
 * @property {number} [minimumPlanningQuantity] Minimum planning order size floor
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
 * Net component shortfall derived during Stage 2 (Inventory Netting & Safety Stock Policy).
 * Calculated as: netRequirement = demandRequirement + safetyStockDeficit.
 *
 * @typedef {Object} NetRequirement
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Customer sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Sales order line item sequence
 * @property {ItemId} itemId Component item ID
 * @property {Quantity} grossRequirement Total gross quantity required before stock netting (Stage 1 output)
 * @property {Quantity} availableInventoryUsed On-hand warehouse stock consumed (Stage 2A output)
 * @property {Quantity} [demandRequirement] Shortage quantity required strictly for sales demand
 * @property {Quantity} [safetyStockDeficit] Buffer quantity required to restore safetyStock
 * @property {Quantity} netRequirement Total effective net requirement (Stage 2B output)
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
 * @property {Quantity} shortageQuantity Raw unfulfilled remaining shortage quantity
 * @property {Quantity} quantity Recommended lot-sized order quantity
 * @property {RequiredDate} requiredDate Upstream customer demand due date
 * @property {Date} plannedReceiptDate Target date materials must arrive (equals requiredDate in V1)
 * @property {Date} plannedReleaseDate Target date order must be released (plannedReceiptDate - leadTimeDays)
 * @property {boolean} isPastDue True if plannedReleaseDate < planningDate
 * @property {string|null} [parentSplitId] Grouping identifier linking split recommendation records
 * @property {number} [splitSequence] 1-based index of split recommendation
 * @property {number} [splitTotalCount] Total number of split recommendations generated
 * @property {string|null} [modifierReason] Reason code ("MAX_ORDER_QUANTITY" | "MINIMUM_PLANNING_QUANTITY" | null)
 * @property {DemandSourceType} demandSourceType Origin source type of demand
 * @property {SalesOrderId} salesOrderId Upstream sales order reference
 * @property {SalesOrderLineId} salesOrderLineId Upstream sales order line item sequence
 * @property {number} bomLevel Tree depth in BOM hierarchy
 * @property {number[]} path Traversal ancestor item path
 */

module.exports = {};
