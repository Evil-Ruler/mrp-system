const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateBackwardSchedule } = require("./leadTimeCalculator");
const { calculateSchedule } = require("./schedulingCalculator");

// ============================================================================
// 1. PURE BACKWARD SCHEDULE CALCULATOR TESTS
// ============================================================================

test("calculateBackwardSchedule - calculates correct plannedReleaseDate for positive lead time", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const planningDate = new Date("2026-08-01T00:00:00.000Z");

  const result = calculateBackwardSchedule(reqDate, 7, planningDate);

  assert.equal(result.requiredDate.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(result.plannedReceiptDate.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(result.plannedReleaseDate.toISOString(), "2026-08-03T00:00:00.000Z");
  assert.equal(result.isPastDue, false);
});

test("calculateBackwardSchedule - handles zero lead time (release date equals receipt date)", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const planningDate = new Date("2026-08-01T00:00:00.000Z");

  const result = calculateBackwardSchedule(reqDate, 0, planningDate);

  assert.equal(result.plannedReceiptDate.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(result.plannedReleaseDate.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(result.isPastDue, false);
});

test("calculateBackwardSchedule - correctly sets isPastDue true when plannedReleaseDate < planningDate", () => {
  const reqDate = new Date("2026-08-05T00:00:00.000Z");
  const planningDate = new Date("2026-08-02T00:00:00.000Z");

  // Release date = 5 Aug - 7 days = 29 July 2026 (< 2 Aug 2026 planning date)
  const result = calculateBackwardSchedule(reqDate, 7, planningDate);

  assert.equal(result.plannedReleaseDate.toISOString(), "2026-07-29T00:00:00.000Z");
  assert.equal(result.isPastDue, true);
});

test("calculateBackwardSchedule - correctly handles month and year boundary transitions", () => {
  const reqDate = new Date("2026-01-03T00:00:00.000Z");
  const planningDate = new Date("2025-12-01T00:00:00.000Z");

  const result = calculateBackwardSchedule(reqDate, 5, planningDate);

  assert.equal(result.plannedReleaseDate.toISOString(), "2025-12-29T00:00:00.000Z");
  assert.equal(result.isPastDue, false);
});

test("calculateBackwardSchedule - returns freshly allocated Date references without mutating inputs", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const result = calculateBackwardSchedule(reqDate, 7);

  assert.notEqual(result.requiredDate, reqDate);
  assert.notEqual(result.plannedReceiptDate, reqDate);
  assert.notEqual(result.plannedReleaseDate, reqDate);
});

// ============================================================================
// 2. SCHEDULING CALCULATOR FACADE TESTS
// ============================================================================

test("calculateSchedule - selects purchaseLeadTimeDays for PURCHASE items", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const itemConfig = {
    procurementType: "PURCHASE",
    purchaseLeadTimeDays: 7,
    manufacturingLeadTimeDays: 20,
  };

  const result = calculateSchedule(reqDate, itemConfig, new Date("2026-08-01T00:00:00.000Z"));

  assert.equal(result.plannedReleaseDate.toISOString(), "2026-08-03T00:00:00.000Z");
});

test("calculateSchedule - selects manufacturingLeadTimeDays for PRODUCTION items", () => {
  const reqDate = new Date("2026-08-20T00:00:00.000Z");
  const itemConfig = {
    procurementType: "PRODUCTION",
    purchaseLeadTimeDays: 7,
    manufacturingLeadTimeDays: 5,
  };

  const result = calculateSchedule(reqDate, itemConfig, new Date("2026-08-01T00:00:00.000Z"));

  assert.equal(result.plannedReleaseDate.toISOString(), "2026-08-15T00:00:00.000Z");
});

test("calculateSchedule - defaults lead time to 0 if itemConfig or lead times are missing", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");

  const res1 = calculateSchedule(reqDate, null, new Date("2026-08-01T00:00:00.000Z"));
  assert.equal(res1.plannedReleaseDate.toISOString(), "2026-08-10T00:00:00.000Z");

  const res2 = calculateSchedule(reqDate, { procurementType: "PURCHASE" }, new Date("2026-08-01T00:00:00.000Z"));
  assert.equal(res2.plannedReleaseDate.toISOString(), "2026-08-10T00:00:00.000Z");
});
