const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateInventoryNetting } = require("./inventoryNetting");

// ============================================================================
// DOMAIN FIXTURE BUILDERS & CONSTANTS
// ============================================================================

const ITEM_BOLT = 3001;
const ITEM_NUT = 3002;

function createExplodedRequirement(overrides = {}) {
  return {
    demandSourceType: "SALES_ORDER",
    salesOrderId: "SO-100",
    salesOrderLineId: 1,
    itemId: ITEM_BOLT,
    requiredQuantity: 20,
    requiredDate: new Date("2026-08-01T00:00:00.000Z"),
    bomLevel: 1,
    path: [1000, ITEM_BOLT],
    ...overrides,
  };
}

function assertNetInvariants(results) {
  for (const res of results) {
    assert.equal(res.demandSourceType, "SALES_ORDER");
    assert.ok(res.grossRequirement > 0, `grossRequirement must be > 0, got ${res.grossRequirement}`);
    assert.ok(res.availableInventoryUsed >= 0, `availableInventoryUsed must be >= 0, got ${res.availableInventoryUsed}`);
    assert.ok(res.netRequirement >= 0, `netRequirement must be >= 0, got ${res.netRequirement}`);
    assert.equal(
      res.grossRequirement,
      res.availableInventoryUsed + res.netRequirement,
      "grossRequirement must equal availableInventoryUsed + netRequirement"
    );
    assert.ok(Array.isArray(res.path) && res.path.length > 0, "path must be non-empty array");
  }
}

// ============================================================================
// 1. BOUNDARY & EMPTY INPUT TESTS
// ============================================================================

test("calculateInventoryNetting - returns empty array for null, undefined, or empty requirements", () => {
  assert.deepStrictEqual(calculateInventoryNetting(null, []), []);
  assert.deepStrictEqual(calculateInventoryNetting(undefined, []), []);
  assert.deepStrictEqual(calculateInventoryNetting([], []), []);
});

test("calculateInventoryNetting - handles missing or null inventory gracefully", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 50 })];
  const results = calculateInventoryNetting(reqs, null);

  assert.equal(results.length, 1);
  assertNetInvariants(results);
  assert.equal(results[0].availableInventoryUsed, 0);
  assert.equal(results[0].netRequirement, 50);
});

// ============================================================================
// 2. INVENTORY NETTING BUSINESS SCENARIOS
// ============================================================================

test("calculateInventoryNetting - handles ZERO inventory (net equals gross)", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 40 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 0 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 1);
  assertNetInvariants(results);
  assert.equal(results[0].grossRequirement, 40);
  assert.equal(results[0].availableInventoryUsed, 0);
  assert.equal(results[0].netRequirement, 40);
});

test("calculateInventoryNetting - handles EXACT inventory match (net equals 0)", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 60 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 60 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 1);
  assertNetInvariants(results);
  assert.equal(results[0].grossRequirement, 60);
  assert.equal(results[0].availableInventoryUsed, 60);
  assert.equal(results[0].netRequirement, 0);
});

test("calculateInventoryNetting - handles PARTIAL inventory (used = available, net = gross - available)", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 50 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 20 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 1);
  assertNetInvariants(results);
  assert.equal(results[0].grossRequirement, 50);
  assert.equal(results[0].availableInventoryUsed, 20);
  assert.equal(results[0].netRequirement, 30);
});

test("calculateInventoryNetting - handles EXCESS inventory (used = gross, net = 0)", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 25 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 100 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 1);
  assertNetInvariants(results);
  assert.equal(results[0].grossRequirement, 25);
  assert.equal(results[0].availableInventoryUsed, 25);
  assert.equal(results[0].netRequirement, 0);
});

// ============================================================================
// 3. CUMULATIVE DEPLETION & MULTI-REQUIREMENT SCENARIOS
// ============================================================================

test("calculateInventoryNetting - processes cumulative depletion across multiple requirements for same item", () => {
  // Inventory: 60 bolts
  // Requirements: 20, 30, 40
  // Expected:
  // Req 1: 20 -> used 20, net 0 (rem 40)
  // Req 2: 30 -> used 30, net 0 (rem 10)
  // Req 3: 40 -> used 10, net 30 (rem 0)
  const reqs = [
    createExplodedRequirement({ salesOrderLineId: 1, requiredQuantity: 20 }),
    createExplodedRequirement({ salesOrderLineId: 2, requiredQuantity: 30 }),
    createExplodedRequirement({ salesOrderLineId: 3, requiredQuantity: 40 }),
  ];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 60 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 3);
  assertNetInvariants(results);

  // Req 1
  assert.equal(results[0].grossRequirement, 20);
  assert.equal(results[0].availableInventoryUsed, 20);
  assert.equal(results[0].netRequirement, 0);

  // Req 2
  assert.equal(results[1].grossRequirement, 30);
  assert.equal(results[1].availableInventoryUsed, 30);
  assert.equal(results[1].netRequirement, 0);

  // Req 3
  assert.equal(results[2].grossRequirement, 40);
  assert.equal(results[2].availableInventoryUsed, 10);
  assert.equal(results[2].netRequirement, 30);
});

test("calculateInventoryNetting - preserves chronological demand priority across multiple sales orders", () => {
  const reqs = [
    createExplodedRequirement({ salesOrderId: "SO-001", requiredQuantity: 30, requiredDate: new Date("2026-08-01") }),
    createExplodedRequirement({ salesOrderId: "SO-002", requiredQuantity: 40, requiredDate: new Date("2026-08-10") }),
  ];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 50 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 2);
  assertNetInvariants(results);

  // SO-001 gets priority
  assert.equal(results[0].salesOrderId, "SO-001");
  assert.equal(results[0].availableInventoryUsed, 30);
  assert.equal(results[0].netRequirement, 0);

  // SO-002 gets remaining 20 stock
  assert.equal(results[1].salesOrderId, "SO-002");
  assert.equal(results[1].availableInventoryUsed, 20);
  assert.equal(results[1].netRequirement, 20);
});

test("calculateInventoryNetting - handles multiple distinct items in inventory correctly", () => {
  const reqs = [
    createExplodedRequirement({ itemId: ITEM_BOLT, requiredQuantity: 30 }),
    createExplodedRequirement({ itemId: ITEM_NUT, requiredQuantity: 50 }),
  ];
  const inventory = [
    { itemId: ITEM_BOLT, availableQuantity: 20 },
    { itemId: ITEM_NUT, availableQuantity: 60 },
  ];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 2);
  assertNetInvariants(results);

  const boltReq = results.find((r) => r.itemId === ITEM_BOLT);
  assert.equal(boltReq.availableInventoryUsed, 20);
  assert.equal(boltReq.netRequirement, 10);

  const nutReq = results.find((r) => r.itemId === ITEM_NUT);
  assert.equal(nutReq.availableInventoryUsed, 50);
  assert.equal(nutReq.netRequirement, 0);
});

// ============================================================================
// 4. IMMUTABILITY & FRESH ALLOCATION TESTS
// ============================================================================

test("calculateInventoryNetting - guarantees inputs are never mutated using structuredClone", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 50 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 30 }];

  const baselineReqs = structuredClone(reqs);
  const baselineInventory = structuredClone(inventory);

  const results = calculateInventoryNetting(reqs, inventory);

  assert.deepStrictEqual(reqs, baselineReqs);
  assert.deepStrictEqual(inventory, baselineInventory);
  assert.notEqual(results, reqs);
});

test("calculateInventoryNetting - returned collections and path arrays are freshly allocated across calls", () => {
  const reqs = [createExplodedRequirement({ requiredQuantity: 50 })];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 30 }];

  const run1 = calculateInventoryNetting(reqs, inventory);
  const run2 = calculateInventoryNetting(reqs, inventory);

  assert.notEqual(run1, run2);
  assert.notEqual(run1[0], run2[0]);
  assert.notEqual(run1[0].path, run2[0].path);

  run1[0].path.push(9999);
  assert.equal(run2[0].path.includes(9999), false);
});

// ============================================================================
// 5. STRESS & DETERMINISM TESTS
// ============================================================================

test("calculateInventoryNetting - handles 1000+ requirements with strict deep equality determinism", () => {
  const COUNT = 1000;
  const reqs = [];

  for (let i = 1; i <= COUNT; i++) {
    reqs.push(
      createExplodedRequirement({
        salesOrderId: `SO-${String(i).padStart(4, "0")}`,
        salesOrderLineId: 1,
        itemId: ITEM_BOLT,
        requiredQuantity: 10,
      })
    );
  }

  // Inventory available: 3500 units -> covers first 350 requirements completely (350 * 10 = 3500)
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 3500 }];

  const run1 = calculateInventoryNetting(reqs, inventory);
  const run2 = calculateInventoryNetting(reqs, inventory);

  assert.equal(run1.length, COUNT);
  assert.deepStrictEqual(run1, run2);

  // First 350 requirements have net = 0
  for (let i = 0; i < 350; i++) {
    assert.equal(run1[i].availableInventoryUsed, 10);
    assert.equal(run1[i].netRequirement, 0);
  }

  // Remaining 650 requirements have net = 10
  for (let i = 350; i < COUNT; i++) {
    assert.equal(run1[i].availableInventoryUsed, 0);
    assert.equal(run1[i].netRequirement, 10);
  }
});

test("calculateInventoryNetting - preserves complete demand lineage on output records", () => {
  const reqDate = new Date("2026-09-15T00:00:00.000Z");
  const reqs = [
    createExplodedRequirement({
      demandSourceType: "SALES_ORDER",
      salesOrderId: "SO-999",
      salesOrderLineId: 42,
      itemId: ITEM_BOLT,
      requiredQuantity: 15,
      requiredDate: reqDate,
      bomLevel: 2,
      path: [100, 200, ITEM_BOLT],
    }),
  ];
  const inventory = [{ itemId: ITEM_BOLT, availableQuantity: 10 }];

  const results = calculateInventoryNetting(reqs, inventory);

  assert.equal(results.length, 1);
  assert.equal(results[0].demandSourceType, "SALES_ORDER");
  assert.equal(results[0].salesOrderId, "SO-999");
  assert.equal(results[0].salesOrderLineId, 42);
  assert.equal(results[0].itemId, ITEM_BOLT);
  assert.equal(results[0].grossRequirement, 15);
  assert.equal(results[0].availableInventoryUsed, 10);
  assert.equal(results[0].netRequirement, 5);
  assert.equal(results[0].requiredDate.toISOString(), reqDate.toISOString());
  assert.equal(results[0].bomLevel, 2);
  assert.deepStrictEqual(results[0].path, [100, 200, ITEM_BOLT]);
});

