/**
 * Fixed Order Quantity (FOQ) Strategy.
 *
 * Recommends orders in fixed batch quantity increments.
 * If shortage exceeds a single batch, order scales up to smallest integer multiple of FOQ.
 */
class FOQStrategy {
  /**
   * Calculates recommendation quantity for Fixed Order Quantity policy.
   *
   * @param {number} shortage Net remaining shortage quantity
   * @param {Object} itemConfig Item master planning configuration
   * @param {number} [itemConfig.fixedOrderQuantity] Fixed order batch size
   * @returns {number} Recommended order quantity
   */
  calculate(shortage, itemConfig = {}) {
    const foq = itemConfig.fixedOrderQuantity;
    if (typeof foq !== "number" || !Number.isFinite(foq) || foq <= 0) {
      return shortage;
    }
    return Math.ceil(shortage / foq) * foq;
  }
}

module.exports = FOQStrategy;
