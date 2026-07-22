const { defaultRegistry } = require("./orderModifierRegistry");

/**
 * Order Modifier Calculator (Facade API).
 *
 * Delegates order modifier calculations to the OrderModifierRegistry strategy chain.
 *
 * @param {number} lotSizedQuantity Base order quantity from Stage 4A Lot Sizing
 * @param {Object} [itemConfig] Item planning DTO
 * @param {OrderModifierRegistry} [registry=defaultRegistry] Registry instance
 * @returns {{quantity: number, modifierReason: string|null}[]} Array of modified order quantity records
 */
function calculateOrderModifiers(lotSizedQuantity, itemConfig = {}, registry = defaultRegistry) {
  return registry.executeChain(lotSizedQuantity, itemConfig);
}

module.exports = {
  calculateOrderModifiers,
};
