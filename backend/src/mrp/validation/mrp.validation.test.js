const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePlanningQuery } = require("./mrp.validation");
const { ValidationError } = require("../errors/mrp.errors");

// ============================================================================
// 1. NON-OBJECT & EMPTY QUERY INPUTS
// ============================================================================

test("validatePlanningQuery - returns empty filters object when query is non-object, empty, or null", () => {
  assert.deepEqual(validatePlanningQuery(), {});
  assert.deepEqual(validatePlanningQuery(null), {});
  assert.deepEqual(validatePlanningQuery(undefined), {});
  assert.deepEqual(validatePlanningQuery({}), {});
  assert.deepEqual(validatePlanningQuery(123), {});
  assert.deepEqual(validatePlanningQuery("abc"), {});
  assert.deepEqual(validatePlanningQuery(true), {});
});

// ============================================================================
// 2. SALESORDERIDS NORMALIZATION, DEDUPLICATION & TYPE SANITIZATION
// ============================================================================

test("validatePlanningQuery - parses and deduplicates comma-separated string into salesOrderIds array", () => {
  const result = validatePlanningQuery({ salesOrderIds: " SO-100 , SO-100 , SO-101 , " });
  assert.deepEqual(result.salesOrderIds, ["SO-100", "SO-101"]);
});

test("validatePlanningQuery - parses and deduplicates array of salesOrderIds ignoring empty strings", () => {
  const result = validatePlanningQuery({ salesOrderIds: ["SO-200", "", "SO-201", "SO-200", " "] });
  assert.deepEqual(result.salesOrderIds, ["SO-200", "SO-201"]);
});

test("validatePlanningQuery - returns empty filters object when salesOrderIds contains only empty values", () => {
  assert.deepEqual(validatePlanningQuery({ salesOrderIds: ",,," }), {});
  assert.deepEqual(validatePlanningQuery({ salesOrderIds: ["", " ", "  "] }), {});
});

test("validatePlanningQuery - throws ValidationError for invalid primitive types passed as salesOrderIds", () => {
  assert.throws(
    () => validatePlanningQuery({ salesOrderIds: 123 }),
    (err) => err instanceof ValidationError && err.message.includes("salesOrderIds must be a comma-separated string or an array")
  );

  assert.throws(
    () => validatePlanningQuery({ salesOrderIds: {} }),
    (err) => err instanceof ValidationError && err.message.includes("salesOrderIds must be a comma-separated string or an array")
  );

  assert.throws(
    () => validatePlanningQuery({ salesOrderIds: true }),
    (err) => err instanceof ValidationError && err.message.includes("salesOrderIds must be a comma-separated string or an array")
  );
});

// ============================================================================
// 3. DATE PARAMETER VALIDATION & ISO-8601 ENFORCEMENT
// ============================================================================

test("validatePlanningQuery - ignores empty or whitespace-only date parameters", () => {
  const result = validatePlanningQuery({
    requiredDateFrom: "",
    requiredDateTo: "   ",
  });
  assert.deepEqual(result, {});
});

test("validatePlanningQuery - accepts YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss.sssZ date formats independently", () => {
  const res1 = validatePlanningQuery({ requiredDateFrom: "2026-08-10" });
  assert.equal(res1.requiredDateFrom, "2026-08-10");

  const res2 = validatePlanningQuery({ requiredDateTo: "2026-08-31T23:59:59.999Z" });
  assert.equal(res2.requiredDateTo, "2026-08-31T23:59:59.999Z");
});

test("validatePlanningQuery - rejects non-ISO date string formats (08/10/2026, 10 Aug 2026)", () => {
  assert.throws(
    () => validatePlanningQuery({ requiredDateFrom: "08/10/2026" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );

  assert.throws(
    () => validatePlanningQuery({ requiredDateTo: "10 Aug 2026" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );

  assert.throws(
    () => validatePlanningQuery({ requiredDateFrom: "Aug 10 2026" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );
});

test("validatePlanningQuery - rejects impossible calendar dates (e.g. 2026-02-30, 2026-13-01)", () => {
  assert.throws(
    () => validatePlanningQuery({ requiredDateFrom: "2026-02-30" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );

  assert.throws(
    () => validatePlanningQuery({ requiredDateTo: "2026-13-01" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );

  assert.throws(
    () => validatePlanningQuery({ requiredDateFrom: "2026-00-01" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );

  assert.throws(
    () => validatePlanningQuery({ requiredDateTo: "2026-12-32" }),
    (err) => err instanceof ValidationError && err.message.includes("ISO-8601")
  );
});

// ============================================================================
// 4. DATE RANGE INVARIANT & DETERMINISM TESTS
// ============================================================================

test("validatePlanningQuery - throws ValidationError when requiredDateFrom is later than requiredDateTo", () => {
  assert.throws(
    () => validatePlanningQuery({
      requiredDateFrom: "2026-09-01",
      requiredDateTo: "2026-08-01",
    }),
    (err) => err instanceof ValidationError && err.message.includes("requiredDateFrom cannot be later than requiredDateTo")
  );
});

test("validatePlanningQuery - accepts valid date range when requiredDateFrom <= requiredDateTo", () => {
  const valid = validatePlanningQuery({
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
  });

  assert.equal(valid.requiredDateFrom, "2026-08-01");
  assert.equal(valid.requiredDateTo, "2026-08-31");
});

test("validatePlanningQuery - guarantees deterministic output across repeated executions", () => {
  const query = {
    salesOrderIds: " SO-100 , SO-101 ",
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
  };

  const res1 = validatePlanningQuery(query);
  const res2 = validatePlanningQuery(query);

  assert.deepEqual(res1, res2);
});
