/**
 * @typedef {Object} Demand
 * @property {string} demandId
 * @property {string} salesOrderId
 * @property {number} salesOrderLineId
 * @property {number} itemId
 * @property {number} quantity
 * @property {Date} requiredDate
 * @property {string} uom
 */

/**
 * @typedef {Object} BomHeader
 * @property {string} bomHeaderId
 * @property {number} parentItemId
 */

/**
 * @typedef {Object} BomLine
 * @property {number} bomLineId
 * @property {string} bomHeaderId
 * @property {number} parentItemId
 * @property {number} childItemId
 * @property {number} qtyPerParent
 */

/**
 * @typedef {Object} Item
 * @property {number} itemId
 * @property {string} itemCode
 * @property {string} itemType
 * @property {string} baseUom
 */

module.exports = {};
