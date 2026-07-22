/**
 * Lead Time Backward Scheduling Calculator.
 *
 * Performs deterministic backward date scheduling using UTC calendar-day offsets.
 */

const MS_PER_DAY = 86400000;

/**
 * Calculates backward-scheduled receipt and release dates given a required date and lead time.
 *
 * **Deterministic Guarantees**:
 * - Date Instance Isolation: Clones input `requiredDate` preventing reference mutation.
 * - UTC Millisecond Safety: Uses UTC millisecond arithmetic avoiding DST and timezone anomalies.
 *
 * @param {Date|string|number} requiredDate Upstream required delivery date
 * @param {number} [leadTimeDays=0] Lead time duration in calendar days (must be integer >= 0)
 * @param {Date} [planningDate] Current planning run reference date (defaults to requirement date if unsupplied)
 * @returns {{requiredDate: Date, plannedReceiptDate: Date, plannedReleaseDate: Date, isPastDue: boolean}}
 */
function calculateBackwardSchedule(requiredDate, leadTimeDays = 0, planningDate) {
  const reqDateObj = requiredDate instanceof Date ? new Date(requiredDate.getTime()) : new Date(requiredDate);
  const plannedReceiptDate = new Date(reqDateObj.getTime());

  const days = (typeof leadTimeDays === "number" && Number.isFinite(leadTimeDays) && leadTimeDays > 0)
    ? Math.floor(leadTimeDays)
    : 0;

  const plannedReleaseDate = new Date(plannedReceiptDate.getTime() - days * MS_PER_DAY);

  const refPlanningDate = planningDate instanceof Date ? planningDate : new Date();
  const isPastDue = plannedReleaseDate.getTime() < refPlanningDate.getTime();

  return {
    requiredDate: reqDateObj,
    plannedReceiptDate,
    plannedReleaseDate,
    isPastDue,
  };
}

module.exports = {
  calculateBackwardSchedule,
};
