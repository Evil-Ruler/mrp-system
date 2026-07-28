/**
 * Minimum Order Quantity (MOQ) Strategy.
 *
 * Recommends exact shortage if shortage >= MOQ, otherwise bumps recommendation up to MOQ.
 */
class MOQStrategy {
  /**
   * Calculates recommendation quantity for Minimum Order Quantity policy.
   *
   * @param {number} shortage Net remaining shortage quantity
   * @param {Object} itemConfig Item master planning configuration
   * @param {number} [itemConfig.minimumOrderQuantity] Minimum order threshold
   * @returns {number} Recommended order quantity
   */
  calculate(shortage, itemConfig = {}) {
    const moq = itemConfig.minimumOrderQuantity;
    if (typeof moq !== "number" || !Number.isFinite(moq) || moq <= 0) {
      return shortage;
    }
    return Math.max(shortage, moq);
  }
}

module.exports = MOQStrategy;
