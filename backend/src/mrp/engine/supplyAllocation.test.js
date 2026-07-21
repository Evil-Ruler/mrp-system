const test = require("node:test");
const assert = require("node:assert/strict");

const { allocateSupply } = require("./supplyAllocation");

// ============================================================================
// DOMAIN FIXTURE BUILDERS & CONSTANTS
// ============================================================================

const ITEM_BOLT = 3001;
const ITEM_NUT = 3002;

function createNetRequirement(overrides = {}) {
  return {
    demandSourceType: "SALES_ORDER",
    salesOrderId: "SO-100",
    salesOrderLineId: 1,
    itemId: ITEM_BOLT,
    grossRequirement: 50,
    availableInventoryUsed: 10,
    netRequirement: 40,
    requiredDate: new Date("2026-08-10T00:00:00.000Z"),
    bomLevel: 1,
    path: [1000, ITEM_BOLT],
    ...overrides,
  };
}

function assertSupplyInvariants(results) {
  for (const res of results) {
    assert.equal(res.demandSourceType, "SALES_ORDER");
    assert.ok(res.purchaseSupplyUsed >= 0, `purchaseSupplyUsed must be >= 0, got ${res.purchaseSupplyUsed}`);
    assert.ok(res.productionSupplyUsed >= 0, `productionSupplyUsed must be >= 0, got ${res.productionSupplyUsed}`);
    assert.ok(res.remainingShortage >= 0, `remainingShortage must be >= 0, got ${res.remainingShortage}`);
    assert.equal(
      res.netRequirement,
      res.purchaseSupplyUsed + res.productionSupplyUsed + res.remainingShortage,
      "netRequirement must equal purchaseSupplyUsed + productionSupplyUsed + remainingShortage"
    );
    assert.ok(Array.isArray(res.path) && res.path.length > 0, "path must be a non-empty array");
  }
}

// ============================================================================
// 1. BOUNDARY & EMPTY INPUT TESTS
// ============================================================================

test("allocateSupply - returns empty array for null, undefined, or empty requirements", () => {
  assert.deepStrictEqual(allocateSupply(null, [], []), []);
  assert.deepStrictEqual(allocateSupply(undefined, [], []), []);
  assert.deepStrictEqual(allocateSupply([], [], []), []);
});

test("allocateSupply - handles missing or empty supply lists gracefully", () => {
  const reqs = [createNetRequirement({ netRequirement: 40 })];
  const results = allocateSupply(reqs, null, undefined);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 0);
  assert.equal(results[0].productionSupplyUsed, 0);
  assert.equal(results[0].remainingShortage, 40);
});

// ============================================================================
// 2. PURCHASE SUPPLY ALLOCATION SCENARIOS
// ============================================================================

test("allocateSupply - allocates EXACT purchase supply match", () => {
  const reqs = [createNetRequirement({ netRequirement: 40 })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 40, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 40);
  assert.equal(results[0].productionSupplyUsed, 0);
  assert.equal(results[0].remainingShortage, 0);
});

test("allocateSupply - allocates PARTIAL purchase supply when stock is insufficient", () => {
  const reqs = [createNetRequirement({ netRequirement: 50 })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 30);
  assert.equal(results[0].productionSupplyUsed, 0);
  assert.equal(results[0].remainingShortage, 20);
});

test("allocateSupply - handles EXCESS purchase supply correctly", () => {
  const reqs = [createNetRequirement({ netRequirement: 30 })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 100, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 30);
  assert.equal(results[0].remainingShortage, 0);
});

// ============================================================================
// 3. PRODUCTION SUPPLY & MIXED ALLOCATION SCENARIOS
// ============================================================================

test("allocateSupply - allocates production supply when no purchase supply exists", () => {
  const reqs = [createNetRequirement({ netRequirement: 40 })];
  const productionOrders = [
    { productionOrderId: "MO-001", itemId: ITEM_BOLT, openQuantity: 40, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, [], productionOrders);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 0);
  assert.equal(results[0].productionSupplyUsed, 40);
  assert.equal(results[0].remainingShortage, 0);
});

test("allocateSupply - allocates mixed purchase AND production supply in priority order", () => {
  // Requirement: 80
  // Purchase: 30
  // Production: 20
  // Expected: purchaseUsed = 30, productionUsed = 20, remainingShortage = 30
  const reqs = [createNetRequirement({ netRequirement: 80 })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") },
  ];
  const productionOrders = [
    { productionOrderId: "MO-001", itemId: ITEM_BOLT, openQuantity: 20, expectedDate: new Date("2026-08-06") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, productionOrders);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 30);
  assert.equal(results[0].productionSupplyUsed, 20);
  assert.equal(results[0].remainingShortage, 30);
});

// ============================================================================
// 4. DATE RULES (expectedDate <= requiredDate)
// ============================================================================

test("allocateSupply - strictly IGNORES LATE supply where expectedDate > requiredDate", () => {
  const reqs = [createNetRequirement({ netRequirement: 100, requiredDate: new Date("2026-08-10") })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-LATE", itemId: ITEM_BOLT, openQuantity: 100, expectedDate: new Date("2026-08-15") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 0);
  assert.equal(results[0].remainingShortage, 100);
});

test("allocateSupply - allocates supply expected on SAME DAY (expectedDate == requiredDate)", () => {
  const reqDate = new Date("2026-08-10T00:00:00.000Z");
  const reqs = [createNetRequirement({ netRequirement: 50, requiredDate: reqDate })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-EXACT", itemId: ITEM_BOLT, openQuantity: 50, expectedDate: reqDate },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 50);
  assert.equal(results[0].remainingShortage, 0);
});

test("allocateSupply - allocates earlier supply before later supply", () => {
  const reqs = [createNetRequirement({ netRequirement: 40, requiredDate: new Date("2026-08-15") })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-LATER", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-10") },
    { purchaseOrderId: "PO-EARLIER", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-01") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].purchaseSupplyUsed, 40);
  assert.equal(results[0].remainingShortage, 0);
});

// ============================================================================
// 5. CUMULATIVE DEPLETION & MULTI-REQUIREMENT SCENARIOS
// ============================================================================

test("allocateSupply - statefully depletes supply orders across sequential requirements", () => {
  // PO: 100
  // Req A: 40 -> allocated 40, PO remaining 60
  // Req B: 70 -> allocated 60, PO remaining 0, shortage 10
  const reqs = [
    createNetRequirement({ salesOrderLineId: 1, netRequirement: 40 }),
    createNetRequirement({ salesOrderLineId: 2, netRequirement: 70 }),
  ];
  const purchaseOrders = [
    { purchaseOrderId: "PO-100", itemId: ITEM_BOLT, openQuantity: 100, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, []);

  assert.equal(results.length, 2);
  assertSupplyInvariants(results);

  assert.equal(results[0].salesOrderLineId, 1);
  assert.equal(results[0].purchaseSupplyUsed, 40);
  assert.equal(results[0].remainingShortage, 0);

  assert.equal(results[1].salesOrderLineId, 2);
  assert.equal(results[1].purchaseSupplyUsed, 60);
  assert.equal(results[1].remainingShortage, 10);
});

test("allocateSupply - handles multiple distinct items across purchase and production orders", () => {
  const reqs = [
    createNetRequirement({ itemId: ITEM_BOLT, netRequirement: 30 }),
    createNetRequirement({ itemId: ITEM_NUT, netRequirement: 50 }),
  ];
  const purchaseOrders = [
    { purchaseOrderId: "PO-BOLT", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") },
  ];
  const productionOrders = [
    { productionOrderId: "MO-NUT", itemId: ITEM_NUT, openQuantity: 50, expectedDate: new Date("2026-08-05") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, productionOrders);

  assert.equal(results.length, 2);
  assertSupplyInvariants(results);

  const boltReq = results.find((r) => r.itemId === ITEM_BOLT);
  assert.equal(boltReq.purchaseSupplyUsed, 30);
  assert.equal(boltReq.productionSupplyUsed, 0);
  assert.equal(boltReq.remainingShortage, 0);

  const nutReq = results.find((r) => r.itemId === ITEM_NUT);
  assert.equal(nutReq.purchaseSupplyUsed, 0);
  assert.equal(nutReq.productionSupplyUsed, 50);
  assert.equal(nutReq.remainingShortage, 0);
});

// ============================================================================
// 6. IMMUTABILITY & FRESH ALLOCATION TESTS
// ============================================================================

test("allocateSupply - guarantees inputs are never mutated using structuredClone", () => {
  const reqs = [createNetRequirement({ netRequirement: 50 })];
  const purchaseOrders = [{ purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") }];
  const productionOrders = [{ productionOrderId: "MO-001", itemId: ITEM_BOLT, openQuantity: 20, expectedDate: new Date("2026-08-05") }];

  const baselineReqs = structuredClone(reqs);
  const baselinePO = structuredClone(purchaseOrders);
  const baselineMO = structuredClone(productionOrders);

  const results = allocateSupply(reqs, purchaseOrders, productionOrders);

  assert.deepStrictEqual(reqs, baselineReqs);
  assert.deepStrictEqual(purchaseOrders, baselinePO);
  assert.deepStrictEqual(productionOrders, baselineMO);
  assert.notEqual(results, reqs);
});

test("allocateSupply - returned collections and path arrays are freshly allocated across calls", () => {
  const reqs = [createNetRequirement({ netRequirement: 50 })];
  const purchaseOrders = [{ purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") }];

  const run1 = allocateSupply(reqs, purchaseOrders, []);
  const run2 = allocateSupply(reqs, purchaseOrders, []);

  assert.notEqual(run1, run2);
  assert.notEqual(run1[0], run2[0]);
  assert.notEqual(run1[0].path, run2[0].path);

  run1[0].path.push(9999);
  assert.equal(run2[0].path.includes(9999), false);
});

// ============================================================================
// 7. STRESS & DETERMINISM TESTS
// ============================================================================

test("allocateSupply - handles 1000+ net requirements and thousands of supply orders deterministically", () => {
  const COUNT = 1000;
  const reqs = [];

  for (let i = 1; i <= COUNT; i++) {
    reqs.push(
      createNetRequirement({
        salesOrderId: `SO-${String(i).padStart(4, "0")}`,
        salesOrderLineId: 1,
        itemId: ITEM_BOLT,
        netRequirement: 10,
        requiredDate: new Date("2026-08-10"),
      })
    );
  }

  // 400 POs of 10 qty each = 4000 total PO supply
  const purchaseOrders = [];
  for (let i = 1; i <= 400; i++) {
    purchaseOrders.push({
      purchaseOrderId: `PO-${i}`,
      itemId: ITEM_BOLT,
      openQuantity: 10,
      expectedDate: new Date("2026-08-05"),
    });
  }

  // 300 MOs of 10 qty each = 3000 total Production supply
  const productionOrders = [];
  for (let i = 1; i <= 300; i++) {
    productionOrders.push({
      productionOrderId: `MO-${i}`,
      itemId: ITEM_BOLT,
      openQuantity: 10,
      expectedDate: new Date("2026-08-06"),
    });
  }

  const run1 = allocateSupply(reqs, purchaseOrders, productionOrders);
  const run2 = allocateSupply(reqs, purchaseOrders, productionOrders);

  assert.equal(run1.length, COUNT);
  assert.deepStrictEqual(run1, run2);

  // First 400 demands satisfied by PO (400 * 10 = 4000)
  for (let i = 0; i < 400; i++) {
    assert.equal(run1[i].purchaseSupplyUsed, 10);
    assert.equal(run1[i].productionSupplyUsed, 0);
    assert.equal(run1[i].remainingShortage, 0);
  }

  // Next 300 demands satisfied by MO (300 * 10 = 3000)
  for (let i = 400; i < 700; i++) {
    assert.equal(run1[i].purchaseSupplyUsed, 0);
    assert.equal(run1[i].productionSupplyUsed, 10);
    assert.equal(run1[i].remainingShortage, 0);
  }

  // Remaining 300 demands have remainingShortage = 10
  for (let i = 700; i < COUNT; i++) {
    assert.equal(run1[i].purchaseSupplyUsed, 0);
    assert.equal(run1[i].productionSupplyUsed, 0);
    assert.equal(run1[i].remainingShortage, 10);
  }
});

test("allocateSupply - allocates multi-tier supply in priority sequence (PO=30, MO=60, Shortage=10 for 100 net requirement)", () => {
  const reqs = [createNetRequirement({ netRequirement: 100 })];
  const purchaseOrders = [
    { purchaseOrderId: "PO-001", itemId: ITEM_BOLT, openQuantity: 30, expectedDate: new Date("2026-08-05") },
  ];
  const productionOrders = [
    { productionOrderId: "MO-001", itemId: ITEM_BOLT, openQuantity: 20, expectedDate: new Date("2026-08-06") },
    { productionOrderId: "MO-002", itemId: ITEM_BOLT, openQuantity: 40, expectedDate: new Date("2026-08-07") },
  ];

  const results = allocateSupply(reqs, purchaseOrders, productionOrders);

  assert.equal(results.length, 1);
  assertSupplyInvariants(results);
  assert.equal(results[0].grossRequirement, 50);
  assert.equal(results[0].netRequirement, 100);
  assert.equal(results[0].purchaseSupplyUsed, 30);
  assert.equal(results[0].productionSupplyUsed, 60);
  assert.equal(results[0].remainingShortage, 10);
});
