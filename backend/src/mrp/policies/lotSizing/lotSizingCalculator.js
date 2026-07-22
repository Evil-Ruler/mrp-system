const registry = require("./lotSizingStrategyRegistry");

/**
 * Facade API for Lot Sizing Calculations.
 *
 * Resolves appropriate strategy via LotSizingStrategyRegistry and calculates order quantity.
 *
 * @param {number} shortage Raw remaining shortage quantity
 * @param {Object} [itemConfig] Item planning configuration object
 * @param {string} [itemConfig.lotSizingPolicy] Lot sizing policy key
 * @returns {number} Recommended order quantity
 */
function calculateLotSize(shortage, itemConfig = {}) {
  if (typeof shortage !== "number" || !Number.isFinite(shortage) || shortage <= 0) {
    return 0;
  }

  const policyKey = itemConfig ? itemConfig.lotSizingPolicy : undefined;
  const strategy = registry.getStrategy(policyKey);
  return strategy.calculate(shortage, itemConfig);
}

module.exports = {
  calculateLotSize,
};
