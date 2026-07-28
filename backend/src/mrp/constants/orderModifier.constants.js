/**
 * Order Modifier Domain Constants.
 */

const ORDER_MODIFIER_REASONS = Object.freeze({
  MAX_ORDER_QUANTITY: "MAX_ORDER_QUANTITY",
  MINIMUM_PLANNING_QUANTITY: "MINIMUM_PLANNING_QUANTITY",
});

/**
 * Maximum upper limit of split recommendation records generated from a single requirement
 * to prevent engine memory exhaustion from pathologically small maxOrderQuantity values.
 */
const MAX_ORDER_SPLITS = 1000;

module.exports = {
  ORDER_MODIFIER_REASONS,
  MAX_ORDER_SPLITS,
};
