const test = require("node:test");
const assert = require("node:assert/strict");

const { generateRecommendations } = require("./recommendationGenerator");

// ============================================================================
// DOMAIN FIXTURE BUILDERS & CONSTANTS
// ============================================================================

const ITEM_PURCHASED = 3001; // e.g. Bolt
const ITEM_MANUFACTURED = 2001; // e.g. Gearbox Sub-Assembly

function createAllocatedRequirement(overrides = {}) {
  return {
    demandSourceType: "SALES_ORDER",
    salesOrderId: "SO-100",
    salesOrderLineId: 1,
    itemId: ITEM_PURCHASED,
    grossRequirement: 50,
    availableInventoryUsed: 10,
    netRequirement: 40,
    purchaseSupplyUsed: 10,
    productionSupplyUsed: 0,
    remainingShortage: 30,
    requiredDate: new Date("2026-08-10T00:00:00.000Z"),
    bomLevel: 1,
    path: [1000, ITEM_PURCHASED],
    ...overrides,
  };
}

function createItemMaster() {
  return [
    { itemId: ITEM_PURCHASED, itemCode: "BOLT-01", procurementType: "PURCHASE" },
    { itemId: ITEM_MANUFACTURED, itemCode: "GEAR-01", procurementType: "PRODUCTION" },
  ];
}

function assertRecommendationInvariants(results, allocatedReqs) {
  for (let i = 0; i < results.length; i++) {
    const rec = results[i];
    assert.equal(rec.demandSourceType, "SALES_ORDER");
    assert.ok(rec.quantity > 0, `quantity must be > 0, got ${rec.quantity}`);
    assert.ok(
      rec.recommendationType === "PURCHASE" || rec.recommendationType === "PRODUCTION",
      `Invalid recommendationType: ${rec.recommendationType}`
    );
    assert.ok(rec.requiredDate instanceof Date, "requiredDate must be a Date instance");
    assert.ok(Array.isArray(rec.path) && rec.path.length > 0, "path must be a non-empty array");

    // Match parent allocated requirement
    const match = allocatedReqs.find(
      (req) => req.salesOrderId === rec.salesOrderId && req.salesOrderLineId === rec.salesOrderLineId && req.itemId === rec.itemId
    );
    assert.ok(match, "Recommendation must map to an allocated requirement");
    assert.equal(rec.quantity, match.remainingShortage, "quantity must equal remainingShortage");
  }
}

// ============================================================================
// 1. BOUNDARY & EMPTY INPUT TESTS
// ============================================================================

test("generateRecommendations - returns empty array for null, undefined, or empty allocated requirements", () => {
  assert.deepStrictEqual(generateRecommendations(null, []), []);
  assert.deepStrictEqual(generateRecommendations(undefined, []), []);
  assert.deepStrictEqual(generateRecommendations([], []), []);
});

test("generateRecommendations - returns empty array when all requirements have remainingShortage <= 0", () => {
  const allocated = [
    createAllocatedRequirement({ remainingShortage: 0 }),
    createAllocatedRequirement({ remainingShortage: -5 }),
  ];

  const results = generateRecommendations(allocated, createItemMaster());
  assert.deepStrictEqual(results, []);
});

// ============================================================================
// 2. PROCUREMENT TYPE & BUSINESS RULE TESTS
// ============================================================================

test("generateRecommendations - generates PURCHASE recommendation for purchased items", () => {
  const allocated = [createAllocatedRequirement({ itemId: ITEM_PURCHASED, remainingShortage: 30 })];
  const items = createItemMaster();

  const results = generateRecommendations(allocated, items);

  assert.equal(results.length, 1);
  assertRecommendationInvariants(results, allocated);
  assert.equal(results[0].recommendationType, "PURCHASE");
  assert.equal(results[0].itemId, ITEM_PURCHASED);
  assert.equal(results[0].quantity, 30);
});

test("generateRecommendations - generates PRODUCTION recommendation for manufactured items", () => {
  const allocated = [createAllocatedRequirement({ itemId: ITEM_MANUFACTURED, remainingShortage: 45 })];
  const items = createItemMaster();

  const results = generateRecommendations(allocated, items);

  assert.equal(results.length, 1);
  assertRecommendationInvariants(results, allocated);
  assert.equal(results[0].recommendationType, "PRODUCTION");
  assert.equal(results[0].itemId, ITEM_MANUFACTURED);
  assert.equal(results[0].quantity, 45);
});

test("generateRecommendations - defaults to PURCHASE when item is unknown or missing procurementType", () => {
  const UNKNOWN_ITEM_ID = 9999;
  const allocated = [createAllocatedRequirement({ itemId: UNKNOWN_ITEM_ID, remainingShortage: 20 })];

  const results = generateRecommendations(allocated, []);

  assert.equal(results.length, 1);
  assertRecommendationInvariants(results, allocated);
  assert.equal(results[0].recommendationType, "PURCHASE");
  assert.equal(results[0].itemId, UNKNOWN_ITEM_ID);
});

test("generateRecommendations - handles mixed shortages (30, 0, 15, 0) by creating exactly 2 recommendations", () => {
  const allocated = [
    createAllocatedRequirement({ salesOrderLineId: 1, remainingShortage: 30 }),
    createAllocatedRequirement({ salesOrderLineId: 2, remainingShortage: 0 }),
    createAllocatedRequirement({ salesOrderLineId: 3, remainingShortage: 15 }),
    createAllocatedRequirement({ salesOrderLineId: 4, remainingShortage: 0 }),
  ];

  const results = generateRecommendations(allocated, createItemMaster());

  assert.equal(results.length, 2);
  assertRecommendationInvariants(results, allocated);

  assert.equal(results[0].salesOrderLineId, 1);
  assert.equal(results[0].quantity, 30);

  assert.equal(results[1].salesOrderLineId, 3);
  assert.equal(results[1].quantity, 15);
});

test("generateRecommendations - defaults to PURCHASE when item master contains invalid procurementType string", () => {
  const allocated = [createAllocatedRequirement({ itemId: ITEM_PURCHASED, remainingShortage: 20 })];
  const items = [{ itemId: ITEM_PURCHASED, procurementType: "INVALID" }];

  const results = generateRecommendations(allocated, items);

  assert.equal(results.length, 1);
  assertRecommendationInvariants(results, allocated);
  assert.equal(results[0].recommendationType, "PURCHASE");
});

test("generateRecommendations - preserves full sales order demand line traceability without aggregation", () => {
  const allocated = [
    createAllocatedRequirement({ salesOrderId: "SO-001", salesOrderLineId: 1, itemId: ITEM_PURCHASED, remainingShortage: 15 }),
    createAllocatedRequirement({ salesOrderId: "SO-001", salesOrderLineId: 2, itemId: ITEM_PURCHASED, remainingShortage: 25 }),
    createAllocatedRequirement({ salesOrderId: "SO-002", salesOrderLineId: 1, itemId: ITEM_MANUFACTURED, remainingShortage: 10 }),
  ];

  const results = generateRecommendations(allocated, createItemMaster());

  assert.equal(results.length, 3);
  assertRecommendationInvariants(results, allocated);

  const rec1 = results.find((r) => r.salesOrderId === "SO-001" && r.salesOrderLineId === 1);
  assert.ok(rec1);
  assert.equal(rec1.quantity, 15);
  assert.equal(rec1.recommendationType, "PURCHASE");

  const rec2 = results.find((r) => r.salesOrderId === "SO-001" && r.salesOrderLineId === 2);
  assert.ok(rec2);
  assert.equal(rec2.quantity, 25);
  assert.equal(rec2.recommendationType, "PURCHASE");

  const rec3 = results.find((r) => r.salesOrderId === "SO-002" && r.salesOrderLineId === 1);
  assert.ok(rec3);
  assert.equal(rec3.quantity, 10);
  assert.equal(rec3.recommendationType, "PRODUCTION");
});

test("generateRecommendations - duplicate item across different sales orders creates separate recommendations without aggregation", () => {
  const allocated = [
    createAllocatedRequirement({ salesOrderId: "SO-001", salesOrderLineId: 1, itemId: ITEM_PURCHASED, remainingShortage: 10 }),
    createAllocatedRequirement({ salesOrderId: "SO-002", salesOrderLineId: 1, itemId: ITEM_PURCHASED, remainingShortage: 20 }),
  ];

  const results = generateRecommendations(allocated, createItemMaster());

  assert.equal(results.length, 2);
  assertRecommendationInvariants(results, allocated);
  assert.equal(results[0].salesOrderId, "SO-001");
  assert.equal(results[0].quantity, 10);
  assert.equal(results[1].salesOrderId, "SO-002");
  assert.equal(results[1].quantity, 20);
});

// ============================================================================
// 3. IMMUTABILITY & FRESH ALLOCATION TESTS
// ============================================================================

test("generateRecommendations - guarantees input data structures are never mutated using structuredClone", () => {
  const allocated = [createAllocatedRequirement({ remainingShortage: 30 })];
  const items = createItemMaster();

  const baselineAllocated = structuredClone(allocated);
  const baselineItems = structuredClone(items);

  const results = generateRecommendations(allocated, items);

  assert.deepStrictEqual(allocated, baselineAllocated);
  assert.deepStrictEqual(items, baselineItems);
  assert.notEqual(results, allocated);
});

test("generateRecommendations - returned collections, requiredDate instances, and path arrays are freshly allocated across calls", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const allocated = [createAllocatedRequirement({ remainingShortage: 30, requiredDate: reqDate })];
  const items = createItemMaster();

  const run1 = generateRecommendations(allocated, items);
  const run2 = generateRecommendations(allocated, items);

  assert.notEqual(run1, run2);
  assert.notEqual(run1[0], run2[0]);

  // Date reference cloning verification
  assert.notEqual(run1[0].requiredDate, allocated[0].requiredDate);
  assert.equal(run1[0].requiredDate.getTime(), allocated[0].requiredDate.getTime());

  // Path array reference cloning verification
  assert.notEqual(run1[0].path, run2[0].path);
  run1[0].path.push(9999);
  assert.equal(run2[0].path.includes(9999), false);
});

// ============================================================================
// 4. STRESS & DETERMINISM TESTS
// ============================================================================

test("generateRecommendations - handles 1000+ allocated requirements deterministically", () => {
  const COUNT = 1000;
  const allocated = [];

  for (let i = 1; i <= COUNT; i++) {
    allocated.push(
      createAllocatedRequirement({
        salesOrderId: `SO-${String(i).padStart(4, "0")}`,
        salesOrderLineId: 1,
        itemId: i % 2 === 0 ? ITEM_PURCHASED : ITEM_MANUFACTURED,
        remainingShortage: (i % 50) + 1,
      })
    );
  }

  const items = createItemMaster();

  const run1 = generateRecommendations(allocated, items);
  const run2 = generateRecommendations(allocated, items);

  assert.equal(run1.length, COUNT);
  assert.deepStrictEqual(run1, run2);
  assertRecommendationInvariants(run1, allocated);
});
