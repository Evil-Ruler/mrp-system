const { PROCUREMENT_TYPES } = require("../../constants/procurement.constants");
const { calculateBackwardSchedule } = require("./leadTimeCalculator");

/**
 * Scheduling Calculator Facade.
 *
 * Selects appropriate lead time attribute based on item procurement strategy
 * and delegates backward scheduling to leadTimeCalculator.
 *
 * @param {Date|string|number} requiredDate Demand required date
 * @param {Object} [itemConfig] Item planning DTO
 * @param {string} [itemConfig.procurementType] Strategy ("PURCHASE" or "PRODUCTION")
 * @param {number} [itemConfig.purchaseLeadTimeDays] Purchase lead time in calendar days
 * @param {number} [itemConfig.manufacturingLeadTimeDays] In-house manufacturing lead time in calendar days
 * @param {Date} [planningDate] MRP execution run date
 * @returns {{requiredDate: Date, plannedReceiptDate: Date, plannedReleaseDate: Date, isPastDue: boolean}}
 */
function calculateSchedule(requiredDate, itemConfig = {}, planningDate) {
  const config = itemConfig || {};
  const isProduction = config.procurementType === PROCUREMENT_TYPES.PRODUCTION;
  const leadTimeDays = isProduction
    ? (config.manufacturingLeadTimeDays || 0)
    : (config.purchaseLeadTimeDays || 0);

  return calculateBackwardSchedule(requiredDate, leadTimeDays, planningDate);
}

module.exports = {
  calculateSchedule,
};
