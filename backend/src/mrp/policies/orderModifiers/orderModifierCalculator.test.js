const test = require("node:test");
const assert = require("node:assert/strict");

const { applyMinPlanningQuantity } = require("./minPlanningQuantityModifier");
const { applyMaxOrderQuantity } = require("./maxOrderQuantityModifier");
const { OrderModifierRegistry, defaultRegistry } = require("./orderModifierRegistry");
const { calculateOrderModifiers } = require("./orderModifierCalculator");
const { ValidationError } = require("../../errors/mrp.errors");

// ============================================================================
// 1. MINIMUM PLANNING QUANTITY MODIFIER TESTS
// ============================================================================

test("applyMinPlanningQuantity - bumps small order quantity to minimum planning floor", () => {
  const result = applyMinPlanningQuantity(30, { minimumPlanningQuantity: 100 });
  assert.deepEqual(result, {
    quantities: [100],
    modifierReason: "MINIMUM_PLANNING_QUANTITY",
  });
});

test("applyMinPlanningQuantity - leaves order quantity unchanged if >= minimum planning floor", () => {
  const result = applyMinPlanningQuantity(150, { minimumPlanningQuantity: 100 });
  assert.deepEqual(result, {
    quantities: [150],
    modifierReason: null,
  });
});

// ============================================================================
// 2. MAXIMUM ORDER QUANTITY MODIFIER TESTS
// ============================================================================

test("applyMaxOrderQuantity - splits oversized order quantity into multiple max-sized batches", () => {
  const result = applyMaxOrderQuantity(450, { maxOrderQuantity: 200 });
  assert.deepEqual(result, {
    quantities: [200, 200, 50],
    modifierReason: "MAX_ORDER_QUANTITY",
  });
});

test("applyMaxOrderQuantity - exact multiple split (1250 with max 500 -> 500, 500, 250)", () => {
  const result = applyMaxOrderQuantity(1250, { maxOrderQuantity: 500 });
  assert.deepEqual(result, {
    quantities: [500, 500, 250],
    modifierReason: "MAX_ORDER_QUANTITY",
  });
});

test("applyMaxOrderQuantity - throws ValidationError if splits exceed upper safety limit", () => {
  assert.throws(
    () => applyMaxOrderQuantity(100000, { maxOrderQuantity: 1 }),
    ValidationError
  );
});

// ============================================================================
// 3. FACADE & REGISTRY CHAIN EXECUTION TESTS
// ============================================================================

test("calculateOrderModifiers - executes precedence 1 (min) then precedence 2 (max)", () => {
  // Shortage 30, Min 100, Max 40 -> Min bumps 30 to 100 -> Max splits 100 into [40, 40, 20]
  const results = calculateOrderModifiers(30, {
    minimumPlanningQuantity: 100,
    maxOrderQuantity: 40,
  });

  assert.equal(results.length, 3);
  assert.equal(results[0].quantity, 40);
  assert.equal(results[0].modifierReason, "MAX_ORDER_QUANTITY");
  assert.equal(results[1].quantity, 40);
  assert.equal(results[2].quantity, 20);
});

test("calculateOrderModifiers - returns single item with null modifierReason when no modifiers apply", () => {
  const results = calculateOrderModifiers(50, {});
  assert.deepEqual(results, [{ quantity: 50, modifierReason: null }]);
});
