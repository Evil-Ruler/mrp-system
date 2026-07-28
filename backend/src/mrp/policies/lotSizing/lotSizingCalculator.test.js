const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateLotSize } = require("./lotSizingCalculator");
const { ValidationError } = require("../../errors/mrp.errors");

// ============================================================================
// 1. LOT-FOR-LOT (L4L) STRATEGY TESTS
// ============================================================================

test("L4LStrategy - recommends exact shortage quantity for L4L policy", () => {
  const result = calculateLotSize(37, { lotSizingPolicy: "L4L" });
  assert.equal(result, 37);
});

test("L4LStrategy - defaults to L4L strategy when lotSizingPolicy is undefined or null", () => {
  assert.equal(calculateLotSize(42), 42);
  assert.equal(calculateLotSize(42, {}), 42);
  assert.equal(calculateLotSize(42, { lotSizingPolicy: null }), 42);
});

// ============================================================================
// 2. FIXED ORDER QUANTITY (FOQ) STRATEGY TESTS
// ============================================================================

test("FOQStrategy - recommends exact FOQ batch size when shortage is less than FOQ", () => {
  const result = calculateLotSize(37, { lotSizingPolicy: "FOQ", fixedOrderQuantity: 100 });
  assert.equal(result, 100);
});

test("FOQStrategy - scales recommendation up to next integer multiple of FOQ when shortage exceeds FOQ", () => {
  const result = calculateLotSize(140, { lotSizingPolicy: "FOQ", fixedOrderQuantity: 100 });
  assert.equal(result, 200);
});

test("FOQStrategy - recommends exact shortage when shortage is an exact multiple of FOQ", () => {
  const result = calculateLotSize(200, { lotSizingPolicy: "FOQ", fixedOrderQuantity: 100 });
  assert.equal(result, 200);
});

test("FOQStrategy - falls back to shortage if fixedOrderQuantity is invalid or unconfigured", () => {
  assert.equal(calculateLotSize(37, { lotSizingPolicy: "FOQ" }), 37);
  assert.equal(calculateLotSize(37, { lotSizingPolicy: "FOQ", fixedOrderQuantity: 0 }), 37);
  assert.equal(calculateLotSize(37, { lotSizingPolicy: "FOQ", fixedOrderQuantity: -10 }), 37);
});

// ============================================================================
// 3. MINIMUM ORDER QUANTITY (MOQ) STRATEGY TESTS
// ============================================================================

test("MOQStrategy - bumps recommendation up to MOQ when shortage is less than MOQ", () => {
  const result = calculateLotSize(18, { lotSizingPolicy: "MOQ", minimumOrderQuantity: 50 });
  assert.equal(result, 50);
});

test("MOQStrategy - recommends exact shortage when shortage meets or exceeds MOQ", () => {
  const result = calculateLotSize(75, { lotSizingPolicy: "MOQ", minimumOrderQuantity: 50 });
  assert.equal(result, 75);
});

test("MOQStrategy - recommends exact shortage when shortage equals MOQ", () => {
  const result = calculateLotSize(50, { lotSizingPolicy: "MOQ", minimumOrderQuantity: 50 });
  assert.equal(result, 50);
});

test("MOQStrategy - falls back to shortage if minimumOrderQuantity is invalid or unconfigured", () => {
  assert.equal(calculateLotSize(18, { lotSizingPolicy: "MOQ" }), 18);
  assert.equal(calculateLotSize(18, { lotSizingPolicy: "MOQ", minimumOrderQuantity: 0 }), 18);
  assert.equal(calculateLotSize(18, { lotSizingPolicy: "MOQ", minimumOrderQuantity: -5 }), 18);
});

// ============================================================================
// 4. ORDER MULTIPLES (ORDER_MULTIPLE) STRATEGY TESTS
// ============================================================================

test("OrderMultipleStrategy - rounds recommendation up to nearest multiple when shortage is not a multiple", () => {
  const result1 = calculateLotSize(31, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 25 });
  assert.equal(result1, 50);

  const result2 = calculateLotSize(74, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 25 });
  assert.equal(result2, 75);
});

test("OrderMultipleStrategy - returns exact shortage when shortage is an exact multiple", () => {
  const result = calculateLotSize(75, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 25 });
  assert.equal(result, 75);
});

test("OrderMultipleStrategy - rounds up to 1 unit multiple when shortage is less than multiple", () => {
  const result = calculateLotSize(5, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 25 });
  assert.equal(result, 25);
});

test("OrderMultipleStrategy - falls back to shortage if orderMultiple is invalid or unconfigured", () => {
  assert.equal(calculateLotSize(31, { lotSizingPolicy: "ORDER_MULTIPLE" }), 31);
  assert.equal(calculateLotSize(31, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 0 }), 31);
  assert.equal(calculateLotSize(31, { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: -25 }), 31);
});

// ============================================================================
// 5. EDGE CASES & REGISTRY VALIDATION
// ============================================================================

test("calculateLotSize - returns 0 for zero or negative shortage", () => {
  assert.equal(calculateLotSize(0, { lotSizingPolicy: "FOQ", fixedOrderQuantity: 100 }), 0);
  assert.equal(calculateLotSize(-15, { lotSizingPolicy: "MOQ", minimumOrderQuantity: 50 }), 0);
  assert.equal(calculateLotSize(null), 0);
});

test("calculateLotSize - throws ValidationError when an unsupported/unknown policy is requested", () => {
  assert.throws(() => calculateLotSize(50, { lotSizingPolicy: "UNKNOWN_POLICY" }), ValidationError);
});
