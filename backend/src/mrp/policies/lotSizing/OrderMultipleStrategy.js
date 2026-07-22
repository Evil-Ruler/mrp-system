/**
 * Order Multiples Strategy.
 *
 * Recommends order quantity rounded up to the nearest integer multiple of configured multiple.
 */
class OrderMultipleStrategy {
  /**
   * Calculates recommendation quantity for Order Multiples policy.
   *
   * @param {number} shortage Net remaining shortage quantity
   * @param {Object} itemConfig Item master planning configuration
   * @param {number} [itemConfig.orderMultiple] Increment rounding multiple
   * @returns {number} Recommended order quantity
   */
  calculate(shortage, itemConfig = {}) {
    const multiple = itemConfig.orderMultiple;
    if (typeof multiple !== "number" || !Number.isFinite(multiple) || multiple <= 0) {
      return shortage;
    }
    return Math.ceil(shortage / multiple) * multiple;
  }
}

module.exports = OrderMultipleStrategy;
