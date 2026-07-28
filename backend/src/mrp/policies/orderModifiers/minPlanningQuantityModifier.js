const { ORDER_MODIFIER_REASONS } = require("../../constants/orderModifier.constants");

/**
 * Precedence 1 Strategy: Minimum Planning Quantity Modifier.
 *
 * Bumps small lot-sized order quantities up to configured minimum planning quantity floor.
 *
 * @param {number} quantity Current lot-sized or modified order quantity
 * @param {Object} [itemConfig] Item planning DTO
 * @param {number} [itemConfig.minimumPlanningQuantity] Configured minimum order floor
 * @returns {{quantities: number[], modifierReason: string|null}} Modified order quantities and modifier reason
 */
function applyMinPlanningQuantity(quantity, itemConfig = {}) {
  const minQty = itemConfig && typeof itemConfig.minimumPlanningQuantity === "number"
    ? itemConfig.minimumPlanningQuantity
    : 0;

  if (minQty > 0 && quantity > 0 && quantity < minQty) {
    return {
      quantities: [minQty],
      modifierReason: ORDER_MODIFIER_REASONS.MINIMUM_PLANNING_QUANTITY,
    };
  }

  return {
    quantities: [quantity],
    modifierReason: null,
  };
}

module.exports = {
  applyMinPlanningQuantity,
};
