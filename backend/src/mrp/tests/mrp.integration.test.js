const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../app");
const repository = require("../repositories/mrp.repository");
const { DataAccessError } = require("../errors/mrp.errors");

let origGetDemandOrderLines;
let origGetItems;
let origGetBomData;
let origGetInventory;
let origGetOpenPurchaseOrders;
let origGetOpenProductionOrders;
let origConsoleError;

test.beforeEach(() => {
  origGetDemandOrderLines = repository.getDemandOrderLines;
  origGetItems = repository.getItems;
  origGetBomData = repository.getBomData;
  origGetInventory = repository.getInventory;
  origGetOpenPurchaseOrders = repository.getOpenPurchaseOrders;
  origGetOpenProductionOrders = repository.getOpenProductionOrders;
  origConsoleError = console.error;
  console.error = () => {}; // Suppress console log output during deliberate error tests
});

test.afterEach(() => {
  repository.getDemandOrderLines = origGetDemandOrderLines;
  repository.getItems = origGetItems;
  repository.getBomData = origGetBomData;
  repository.getInventory = origGetInventory;
  repository.getOpenPurchaseOrders = origGetOpenPurchaseOrders;
  repository.getOpenProductionOrders = origGetOpenProductionOrders;
  console.error = origConsoleError;
});

// Helper function to mock clean real-world MRP dataset across all repository endpoints
function setupRealWorldDataset() {
  repository.getDemandOrderLines = async (filters = {}) => {
    let lines = [
      { demandId: "SO-100:1", salesOrderId: "SO-100", salesOrderLineId: 1, itemId: 1000, quantity: 10, requiredDate: new Date("2026-08-10T00:00:00.000Z"), uom: "PCS" },
      { demandId: "SO-101:1", salesOrderId: "SO-101", salesOrderLineId: 1, itemId: 1000, quantity: 20, requiredDate: new Date("2026-08-15T00:00:00.000Z"), uom: "PCS" },
      { demandId: "SO-102:1", salesOrderId: "SO-102", salesOrderLineId: 1, itemId: 1000, quantity: 5, requiredDate: new Date("2026-09-01T00:00:00.000Z"), uom: "PCS" },
    ];

    if (filters.salesOrderIds && filters.salesOrderIds.length > 0) {
      lines = lines.filter((l) => filters.salesOrderIds.includes(l.salesOrderId));
    }

    if (filters.requiredDateFrom) {
      const fromTime = new Date(filters.requiredDateFrom).getTime();
      lines = lines.filter((l) => new Date(l.requiredDate).getTime() >= fromTime);
    }

    if (filters.requiredDateTo) {
      const toTime = new Date(filters.requiredDateTo).getTime();
      lines = lines.filter((l) => new Date(l.requiredDate).getTime() <= toTime);
    }

    return lines;
  };

  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 2000, itemCode: "SA-2000", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3000, itemCode: "RM-3000", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];

  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-1000", parentItemId: 1000 },
      { bomHeaderId: "BOM-2000", parentItemId: 2000 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-1000", parentItemId: 1000, childItemId: 2000, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-2000", parentItemId: 2000, childItemId: 3000, qtyPerParent: 5 },
    ],
  });

  repository.getInventory = async () => [
    { itemId: 2000, availableQuantity: 10 }, // Covers 10 SA-2000
    { itemId: 3000, availableQuantity: 50 }, // Covers 50 RM-3000
  ];

  repository.getOpenPurchaseOrders = async () => [
    { purchaseOrderId: "PO-1", itemId: 3000, openQuantity: 20, expectedDate: new Date("2026-08-05") },
  ];

  repository.getOpenProductionOrders = async () => [
    { productionOrderId: "MO-1", itemId: 2000, openQuantity: 10, expectedDate: new Date("2026-08-05") },
  ];
}

// ============================================================================
// SCENARIO 1: REAL FULL MRP ENGINE EXECUTION THROUGH ENTIRE APP STACK
// ============================================================================

test("Scenario 1: Real Full MRP Engine Execution - HTTP GET /api/mrp/run processes full pipeline", async () => {
  setupRealWorldDataset();

  const response = await request(app)
    .get("/api/mrp/run")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.ok(response.body.data.planningDate);
  assert.ok(response.body.data.summary);
  assert.ok(Array.isArray(response.body.data.salesOrders));
  assert.ok(Array.isArray(response.body.data.explodedRequirements));
  assert.ok(Array.isArray(response.body.data.netRequirements));
  assert.ok(Array.isArray(response.body.data.allocatedRequirements));
  assert.ok(Array.isArray(response.body.data.recommendations));
});

// ============================================================================
// SCENARIO 2: SALES ORDER ID FILTERING INTEGRATION
// ============================================================================

test("Scenario 2: Sales Order ID Filtering - processes only requested demand lines", async () => {
  setupRealWorldDataset();

  const response = await request(app)
    .get("/api/mrp/run?salesOrderIds=SO-100")
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.salesOrders.length, 1);
  assert.equal(response.body.data.salesOrders[0].salesOrderId, "SO-100");
});

// ============================================================================
// SCENARIO 3: DATE RANGE FILTERING INTEGRATION
// ============================================================================

test("Scenario 3: Date Range Filtering - processes demand strictly within date boundaries", async () => {
  setupRealWorldDataset();

  const response = await request(app)
    .get("/api/mrp/run?requiredDateFrom=2026-08-01&requiredDateTo=2026-08-20")
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.salesOrders.length, 2);
  const orderIds = response.body.data.salesOrders.map((s) => s.salesOrderId);
  assert.deepEqual(orderIds, ["SO-100", "SO-101"]);
});

// ============================================================================
// SCENARIO 4: BOM EXPLOSION INVARIANTS
// ============================================================================

test("Scenario 4: BOM Explosion Invariants - verifies exploded requirement quantities and lineage", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const exploded = response.body.data.explodedRequirements;
  assert.ok(exploded.length > 0);

  for (const req of exploded) {
    assert.ok(req.requiredQuantity > 0, "Exploded requiredQuantity must be positive");
    assert.ok(req.salesOrderId, "Must reference originating salesOrderId");
    assert.ok(req.salesOrderLineId, "Must reference originating salesOrderLineId");
    assert.ok(Array.isArray(req.path), "Must contain ancestry path array");
  }
});

// ============================================================================
// SCENARIO 5: INVENTORY NETTING INVARIANTS
// ============================================================================

test("Scenario 5: Inventory Netting Invariants - netRequirement <= grossRequirement and non-negative", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const netReqs = response.body.data.netRequirements;
  assert.ok(netReqs.length > 0);

  for (const net of netReqs) {
    assert.ok(net.netRequirement <= net.grossRequirement, "Net Requirement must be <= Gross Requirement");
    assert.ok(net.netRequirement >= 0, "Net Requirement must never be negative");
    assert.ok(net.availableInventoryUsed >= 0, "Inventory used must be non-negative");
  }
});

// ============================================================================
// SCENARIO 6: SUPPLY ALLOCATION INVARIANTS
// ============================================================================

test("Scenario 6: Supply Allocation Invariants - allocated quantity <= net requirement", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const allocated = response.body.data.allocatedRequirements;
  assert.ok(allocated.length > 0);

  for (const alloc of allocated) {
    const allocatedSupply = (alloc.purchaseSupplyUsed || 0) + (alloc.productionSupplyUsed || 0);
    assert.ok(allocatedSupply <= alloc.netRequirement, "Allocated supply must be <= Net Requirement");
    assert.ok(alloc.remainingShortage >= 0, "Remaining shortage must be non-negative");
  }
});

// ============================================================================
// SCENARIO 7: RECOMMENDATION OUTPUT CONTRACTS
// ============================================================================

test("Scenario 7: Recommendation Contracts - every recommendation has valid type, quantity, and requiredDate", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const recs = response.body.data.recommendations;
  assert.ok(recs.length > 0);

  for (const rec of recs) {
    assert.ok(["PURCHASE", "PRODUCTION"].includes(rec.recommendationType));
    assert.ok(rec.itemId, "Must contain itemId");
    assert.ok(rec.quantity > 0, "Recommendation quantity must be > 0");
    assert.ok(rec.requiredDate, "Must contain requiredDate");
    assert.ok(rec.salesOrderId, "Must retain salesOrderId lineage");
  }
});

// ============================================================================
// SCENARIO 8: PLANNING SUMMARY RECONCILIATION
// ============================================================================

test("Scenario 8: Planning Summary Reconciliation - summary counts reconcile with detailed collections", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const data = response.body.data;
  const summary = data.summary;

  assert.equal(summary.salesOrderCount, data.salesOrders.length);
  assert.equal(summary.explodedRequirementCount, data.explodedRequirements.length);
  assert.equal(summary.netRequirementCount, data.netRequirements.length);
  assert.equal(summary.allocatedRequirementCount, data.allocatedRequirements.length);
  assert.equal(summary.recommendationCount, data.recommendations.length);

  const purchaseCount = data.recommendations.filter((r) => r.recommendationType === "PURCHASE").length;
  const productionCount = data.recommendations.filter((r) => r.recommendationType === "PRODUCTION").length;

  assert.equal(summary.purchaseRecommendationCount, purchaseCount);
  assert.equal(summary.productionRecommendationCount, productionCount);
});

// ============================================================================
// SCENARIO 9: SYSTEM EXECUTION DETERMINISM
// ============================================================================

test("Scenario 9: System Execution Determinism - repeated HTTP calls produce identical planning results", async () => {
  setupRealWorldDataset();

  const res1 = await request(app).get("/api/mrp/run").expect(200);
  const res2 = await request(app).get("/api/mrp/run").expect(200);

  const data1 = res1.body.data;
  const data2 = res2.body.data;

  // Ignore dynamic timestamp comparisons
  assert.deepEqual(data1.summary, data2.summary);
  assert.deepEqual(data1.salesOrders, data2.salesOrders);
  assert.deepEqual(data1.explodedRequirements, data2.explodedRequirements);
  assert.deepEqual(data1.recommendations, data2.recommendations);
});

// ============================================================================
// SCENARIO 10: EMPTY FILTER MATCH HANDLING
// ============================================================================

test("Scenario 10: Empty Filter Match Handling - returns 200 OK and zeroed summary when no demand matches", async () => {
  setupRealWorldDataset();

  const response = await request(app)
    .get("/api/mrp/run?salesOrderIds=SO-NONEXISTENT-99999")
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.salesOrders.length, 0);
  assert.equal(response.body.data.explodedRequirements.length, 0);
  assert.equal(response.body.data.recommendations.length, 0);
  assert.equal(response.body.data.summary.recommendationCount, 0);
});

// ============================================================================
// SCENARIO 11: REAL VALIDATION PIPELINE INTERCEPTION
// ============================================================================

test("Scenario 11: Real Validation Interception - returns 400 Bad Request for invalid date query parameter", async () => {
  setupRealWorldDataset();

  const response = await request(app)
    .get("/api/mrp/run?requiredDateFrom=invalid-iso-date")
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

// ============================================================================
// SCENARIO 12: REAL REPOSITORY FAILURE PROPAGATION
// ============================================================================

test("Scenario 12: Repository Failure Propagation - returns 500 Internal Server Error when repository fails", async () => {
  setupRealWorldDataset();

  repository.getDemandOrderLines = async () => {
    throw new DataAccessError("Failed to query demand lines from database");
  };

  const response = await request(app)
    .get("/api/mrp/run")
    .expect(500);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "DATA_ACCESS_ERROR");
  assert.equal(response.body.error.message, "Failed to query demand lines from database");
});

// ============================================================================
// SCENARIO 13: END-TO-END PIPELINE NET REQUIREMENT VERIFICATION
// ============================================================================

test("Scenario 13: Net Requirements Verification - verifies netRequirement = grossRequirement - availableInventoryUsed and full pipeline progression", async () => {
  setupRealWorldDataset();

  const response = await request(app).get("/api/mrp/run").expect(200);

  const netReqs = response.body.data.netRequirements;
  const allocReqs = response.body.data.allocatedRequirements;

  assert.ok(netReqs.length > 0, "netRequirements must be populated");
  assert.equal(netReqs.length, allocReqs.length, "netRequirements and allocatedRequirements length must match");

  for (let i = 0; i < netReqs.length; i++) {
    const net = netReqs[i];
    const alloc = allocReqs[i];

    // Verify Stage 2 Gross-to-Net formula
    assert.equal(
      net.netRequirement,
      net.grossRequirement - net.availableInventoryUsed,
      "netRequirement must strictly equal grossRequirement - availableInventoryUsed"
    );

    // Verify Stage 3 Supply Allocation formula
    assert.equal(alloc.netRequirement, net.netRequirement, "Allocated record must preserve Stage 2 netRequirement");
    assert.equal(
      alloc.remainingShortage,
      Math.max(0, alloc.netRequirement - (alloc.purchaseSupplyUsed + alloc.productionSupplyUsed)),
      "remainingShortage must equal netRequirement - allocated supply"
    );
  }
});
