/**
 * Lot-for-Lot (L4L) Strategy.
 *
 * Recommends order quantity equal to exact unfulfilled remaining shortage.
 */
class L4LStrategy {
  /**
   * Calculates recommendation quantity for Lot-for-Lot policy.
   *
   * @param {number} shortage Net remaining shortage quantity
   * @returns {number} Recommended order quantity (equals shortage)
   */
  calculate(shortage) {
    return shortage;
  }
}

module.exports = L4LStrategy;
