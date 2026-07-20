const test = require("node:test");
const assert = require("node:assert/strict");

const { explodeBom } = require("./bomExplosion");
const { ValidationError } = require("../errors/mrp.errors");

// ============================================================================
// DOMAIN FIXTURE BUILDERS & CONSTANTS
// ============================================================================

const FG_ITEM_ID = 1000;
const SA_ITEM_ID = 2000;
const RM_ITEM_ID = 3000;
const RM_ITEM_ID_2 = 3001;

function createDemandLine(overrides = {}) {
  return {
    salesOrderId: "SO-100",
    salesOrderLineId: 1,
    itemId: FG_ITEM_ID,
    quantity: 10,
    requiredDate: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createBom(lines = [], headers = []) {
  return {
    headers: headers.length > 0 ? headers : [{ bomHeaderId: "BOM-1000", parentItemId: FG_ITEM_ID }],
    lines,
  };
}

function createPlanningData(demand = [], bomLines = [], items = []) {
  return {
    demand: Array.isArray(demand) ? demand : [createDemandLine()],
    bom: createBom(bomLines),
    items,
  };
}

/**
 * Property-based invariant assertion helper.
 * Verifies that EVERY exploded requirement adheres strictly to engine domain invariants.
 */
function assertRequirementInvariants(results, rootItemId) {
  for (const req of results) {
    assert.equal(req.demandSourceType, "SALES_ORDER");
    assert.ok(req.requiredQuantity > 0, `requiredQuantity must be > 0, got ${req.requiredQuantity}`);
    assert.equal(req.path[0], rootItemId, "Path must begin with root Finished Good ID");
    assert.equal(req.path[req.path.length - 1], req.itemId, "Path must end with current item ID");
    assert.equal(req.path.length, req.bomLevel + 1, "Path length must equal bomLevel + 1");
    assert.ok(req.itemId !== rootItemId, "Root Finished Good must never be emitted in explosion output");
  }
}

// ============================================================================
// 1. INPUT VALIDATION & BOUNDARY TESTS
// ============================================================================

test("explodeBom - returns empty array when input is null, undefined, or empty demand", () => {
  assert.deepStrictEqual(explodeBom(null), []);
  assert.deepStrictEqual(explodeBom(undefined), []);
  assert.deepStrictEqual(explodeBom({ demand: [] }), []);
  assert.deepStrictEqual(explodeBom({ demand: null }), []);
});

test("explodeBom - returns empty array when demanded finished good has no BOM lines", () => {
  const planningData = createPlanningData([createDemandLine()], []);
  const results = explodeBom(planningData);

  assert.deepStrictEqual(results, []);
});

// ============================================================================
// 2. EXPLOSION HIERARCHY & QUANTITY PROPAGATION
// ============================================================================

test("explodeBom - explodes single-level BOM with correct quantity calculation and invariants", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 2 },
    { bomLineId: 2, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID_2, qtyPerParent: 5 },
  ];
  const planningData = createPlanningData([createDemandLine({ quantity: 10 })], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 2);
  assertRequirementInvariants(results, FG_ITEM_ID);

  const rm1 = results.find((r) => r.itemId === RM_ITEM_ID);
  assert.ok(rm1);
  assert.equal(rm1.requiredQuantity, 20); // 10 * 2
  assert.equal(rm1.bomLevel, 1);

  const rm2 = results.find((r) => r.itemId === RM_ITEM_ID_2);
  assert.ok(rm2);
  assert.equal(rm2.requiredQuantity, 50); // 10 * 5
  assert.equal(rm2.bomLevel, 1);
});

test("explodeBom - explodes multi-level BOM propagating recursive quantity multiplication", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: SA_ITEM_ID, qtyPerParent: 3 },
    { bomLineId: 2, parentItemId: SA_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 4 },
  ];
  const planningData = createPlanningData([createDemandLine({ quantity: 5 })], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 2);
  assertRequirementInvariants(results, FG_ITEM_ID);

  const subAssembly = results.find((r) => r.itemId === SA_ITEM_ID);
  assert.ok(subAssembly);
  assert.equal(subAssembly.requiredQuantity, 15); // 5 * 3
  assert.equal(subAssembly.bomLevel, 1);

  const rawMaterial = results.find((r) => r.itemId === RM_ITEM_ID);
  assert.ok(rawMaterial);
  assert.equal(rawMaterial.requiredQuantity, 60); // 15 * 4
  assert.equal(rawMaterial.bomLevel, 2);
});

test("explodeBom - leaf sub-assembly without child BOM lines terminates recursion cleanly", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: SA_ITEM_ID, qtyPerParent: 2 },
  ];
  const planningData = createPlanningData([createDemandLine()], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 1);
  assertRequirementInvariants(results, FG_ITEM_ID);
  assert.equal(results[0].itemId, SA_ITEM_ID);
  assert.equal(results[0].bomLevel, 1);
});

// ============================================================================
// 3. DEEP RECURSION & COMPLEX HIERARCHY TESTS
// ============================================================================

test("explodeBom - succeeds on deep 25-level recursive BOM without stack overflow", () => {
  const DEPTH = 25;
  const bomLines = [];

  for (let level = 1; level < DEPTH; level++) {
    const parentId = 1000 + level - 1;
    const childId = 1000 + level;
    bomLines.push({
      bomLineId: level,
      parentItemId: parentId,
      childItemId: childId,
      qtyPerParent: 2,
    });
  }

  const planningData = createPlanningData([createDemandLine({ itemId: 1000, quantity: 1 })], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, DEPTH - 1);
  assertRequirementInvariants(results, 1000);

  for (let i = 0; i < results.length; i++) {
    const req = results[i];
    const expectedLevel = i + 1;
    const expectedQuantity = Math.pow(2, expectedLevel);

    assert.equal(req.bomLevel, expectedLevel);
    assert.equal(req.requiredQuantity, expectedQuantity);
  }
});

test("explodeBom - preserves distinct unaggregated component requirements for multi-path/diamond BOMs", () => {
  const SA_1 = 2001;
  const SA_2 = 2002;
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: SA_1, qtyPerParent: 1 },
    { bomLineId: 2, parentItemId: FG_ITEM_ID, childItemId: SA_2, qtyPerParent: 1 },
    { bomLineId: 3, parentItemId: SA_1, childItemId: RM_ITEM_ID, qtyPerParent: 3 },
    { bomLineId: 4, parentItemId: SA_2, childItemId: RM_ITEM_ID, qtyPerParent: 5 },
  ];
  const planningData = createPlanningData([createDemandLine({ quantity: 2 })], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 4);
  assertRequirementInvariants(results, FG_ITEM_ID);

  const rmRequirements = results.filter((r) => r.itemId === RM_ITEM_ID);
  assert.equal(rmRequirements.length, 2);

  const path1Req = rmRequirements.find((r) => r.path.includes(SA_1));
  assert.ok(path1Req);
  assert.equal(path1Req.requiredQuantity, 6);

  const path2Req = rmRequirements.find((r) => r.path.includes(SA_2));
  assert.ok(path2Req);
  assert.equal(path2Req.requiredQuantity, 10);
});

// ============================================================================
// 4. BUSINESS CONTRACT & LINEAGE INTEGRITY TESTS
// ============================================================================

test("explodeBom - duplicate child BOM lines under same parent remain unaggregated", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 2 },
    { bomLineId: 2, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 3 },
  ];
  const planningData = createPlanningData([createDemandLine({ quantity: 10 })], bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 2);
  assertRequirementInvariants(results, FG_ITEM_ID);

  const quantities = results.map((r) => r.requiredQuantity);
  assert.deepStrictEqual(quantities, [20, 30]);
});

// ============================================================================
// 5. MULTI-ORDER & MULTI-LINE DEMAND TESTS
// ============================================================================

test("explodeBom - handles multiple independent sales orders and demand lines without cross-aggregation", () => {
  const demand = [
    createDemandLine({ salesOrderId: "SO-001", salesOrderLineId: 1, quantity: 5 }),
    createDemandLine({ salesOrderId: "SO-002", salesOrderLineId: 1, quantity: 10 }),
    createDemandLine({ salesOrderId: "SO-002", salesOrderLineId: 2, quantity: 15 }),
  ];
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 2 },
  ];
  const planningData = createPlanningData(demand, bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 3);
  assertRequirementInvariants(results, FG_ITEM_ID);

  const so1Req = results.find((r) => r.salesOrderId === "SO-001" && r.salesOrderLineId === 1);
  assert.ok(so1Req);
  assert.equal(so1Req.requiredQuantity, 10);

  const so2Line1 = results.find((r) => r.salesOrderId === "SO-002" && r.salesOrderLineId === 1);
  assert.ok(so2Line1);
  assert.equal(so2Line1.requiredQuantity, 20);

  const so2Line2 = results.find((r) => r.salesOrderId === "SO-002" && r.salesOrderLineId === 2);
  assert.ok(so2Line2);
  assert.equal(so2Line2.requiredQuantity, 30);
});

// ============================================================================
// 6. ERROR HANDLING & CYCLE DETECTION TESTS
// ============================================================================

test("explodeBom - throws ValidationError on cyclic BOM dependency", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: SA_ITEM_ID, qtyPerParent: 1 },
    { bomLineId: 2, parentItemId: SA_ITEM_ID, childItemId: FG_ITEM_ID, qtyPerParent: 1 },
  ];
  const planningData = createPlanningData([createDemandLine()], bomLines);

  assert.throws(
    () => explodeBom(planningData),
    (err) => err instanceof ValidationError && err.message.includes(`Cyclic BOM dependency detected for item ${FG_ITEM_ID}`)
  );
});

test("explodeBom - computes requirement quantity assuming pre-validated positive qtyPerParent multipliers", () => {
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 4 },
  ];
  const planningData = createPlanningData([createDemandLine({ quantity: 5 })], bomLines);
  const results = explodeBom(planningData);

  assert.equal(results.length, 1);
  assert.equal(results[0].requiredQuantity, 20);
});

// ============================================================================
// 7. IMMUTABILITY & OBJECT INDEPENDENCE TESTS
// ============================================================================

test("explodeBom - guarantees input planningData is never mutated using structuredClone", () => {
  const planningData = createPlanningData(
    [createDemandLine({ quantity: 5 })],
    [{ bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 2 }]
  );

  const baseline = structuredClone(planningData);
  const results = explodeBom(planningData);

  assert.deepStrictEqual(planningData, baseline);
  assert.notEqual(results, planningData);
});

test("explodeBom - returned collections and nested paths are freshly allocated across multiple calls", () => {
  const planningData = createPlanningData(
    [createDemandLine()],
    [{ bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 2 }]
  );

  const run1 = explodeBom(planningData);
  const run2 = explodeBom(planningData);

  assert.notEqual(run1, run2);
  assert.notEqual(run1[0], run2[0]);
  assert.notEqual(run1[0].path, run2[0].path);

  run1[0].path.push(9999);
  assert.equal(run2[0].path.includes(9999), false);
});

// ============================================================================
// 8. DETERMINISTIC COMPOUND SORTING TESTS
// ============================================================================

test("explodeBom - produces deterministic 5-key compound sorting across full result set", () => {
  const demand = [
    createDemandLine({ salesOrderId: "SO-002", salesOrderLineId: 1, requiredDate: new Date("2026-08-10T00:00:00.000Z") }),
    createDemandLine({ salesOrderId: "SO-001", salesOrderLineId: 1, requiredDate: new Date("2026-08-01T00:00:00.000Z") }),
  ];
  const bomLines = [
    { bomLineId: 1, parentItemId: FG_ITEM_ID, childItemId: SA_ITEM_ID, qtyPerParent: 1 },
    { bomLineId: 2, parentItemId: SA_ITEM_ID, childItemId: RM_ITEM_ID, qtyPerParent: 1 },
    { bomLineId: 3, parentItemId: FG_ITEM_ID, childItemId: RM_ITEM_ID_2, qtyPerParent: 1 },
  ];
  const planningData = createPlanningData(demand, bomLines);

  const results = explodeBom(planningData);

  assert.equal(results.length, 6);

  // Verify full deterministic comparator contract order across all elements
  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i];
    const next = results[i + 1];

    const dateCompare = current.requiredDate.getTime() - next.requiredDate.getTime();
    if (dateCompare === 0) {
      const levelCompare = current.bomLevel - next.bomLevel;
      if (levelCompare === 0) {
        const itemCompare = current.itemId - next.itemId;
        if (itemCompare === 0) {
          const orderCompare = current.salesOrderId.localeCompare(next.salesOrderId);
          if (orderCompare === 0) {
            assert.ok(current.salesOrderLineId <= next.salesOrderLineId);
          } else {
            assert.ok(orderCompare < 0);
          }
        } else {
          assert.ok(itemCompare < 0);
        }
      } else {
        assert.ok(levelCompare < 0);
      }
    } else {
      assert.ok(dateCompare < 0);
    }
  }
});

// ============================================================================
// 9. STRESS & SCALABILITY TESTS
// ============================================================================

test("explodeBom - handles large explosion volume (150 demands, 3000 requirements) with strict deep equality determinism", () => {
  const DEMAND_COUNT = 150;
  const demandList = [];

  for (let i = 1; i <= DEMAND_COUNT; i++) {
    demandList.push(
      createDemandLine({
        salesOrderId: `SO-${String(i).padStart(3, "0")}`,
        salesOrderLineId: 1,
        quantity: 10,
        requiredDate: new Date(2026, 7, (i % 30) + 1),
      })
    );
  }

  // 1 FG -> 10 Sub-assemblies -> each has 1 Raw Material = 20 requirements per demand line
  const bomLines = [];
  for (let sa = 1; sa <= 10; sa++) {
    const saId = 2000 + sa;
    const rmId = 3000 + sa;
    bomLines.push({ bomLineId: sa, parentItemId: FG_ITEM_ID, childItemId: saId, qtyPerParent: 1 });
    bomLines.push({ bomLineId: 100 + sa, parentItemId: saId, childItemId: rmId, qtyPerParent: 2 });
  }

  const planningData = createPlanningData(demandList, bomLines);

  const resultsRun1 = explodeBom(planningData);
  const resultsRun2 = explodeBom(planningData);

  assert.equal(resultsRun1.length, 3000);
  assert.deepStrictEqual(resultsRun1, resultsRun2);
});
