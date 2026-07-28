const { ORDER_MODIFIER_REASONS, MAX_ORDER_SPLITS } = require("../../constants/orderModifier.constants");
const { ValidationError } = require("../../errors/mrp.errors");

/**
 * Precedence 2 Strategy: Maximum Order Quantity Modifier.
 *
 * Caps individual order batch sizes and splits oversized recommendation quantities into
 * multiple planned order quantities.
 *
 * @param {number} quantity Current order quantity
 * @param {Object} [itemConfig] Item planning DTO
 * @param {number} [itemConfig.maxOrderQuantity] Configured maximum order cap
 * @returns {{quantities: number[], modifierReason: string|null}} Array of split order quantities and modifier reason
 */
function applyMaxOrderQuantity(quantity, itemConfig = {}) {
  const maxQty = itemConfig && typeof itemConfig.maxOrderQuantity === "number"
    ? itemConfig.maxOrderQuantity
    : 0;

  if (maxQty <= 0 || quantity <= maxQty) {
    return {
      quantities: [quantity],
      modifierReason: null,
    };
  }

  const splitCount = Math.ceil(quantity / maxQty);
  if (splitCount > MAX_ORDER_SPLITS) {
    throw new ValidationError(
      `maxOrderQuantity (${maxQty}) generates ${splitCount} split orders for quantity ${quantity}, exceeding safety limit of ${MAX_ORDER_SPLITS}.`
    );
  }

  const quantities = [];
  let remaining = quantity;

  while (remaining > 0) {
    const chunk = Math.min(remaining, maxQty);
    quantities.push(chunk);
    remaining -= chunk;
  }

  return {
    quantities,
    modifierReason: ORDER_MODIFIER_REASONS.MAX_ORDER_QUANTITY,
  };
}

module.exports = {
  applyMaxOrderQuantity,
};
