const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../app");
const mrpService = require("../services/mrp.service");
const { DataAccessError } = require("../errors/mrp.errors");

let origRunPlanning;
let origGetPlanningData;
let origGetAllSalesOrders;
let origConsoleError;

test.beforeEach(() => {
  origRunPlanning = mrpService.runPlanning;
  origGetPlanningData = mrpService.getPlanningData;
  origGetAllSalesOrders = mrpService.getAllSalesOrders;
  origConsoleError = console.error;
  console.error = () => {}; // Suppress console log noise during error tests
});

test.afterEach(() => {
  mrpService.runPlanning = origRunPlanning;
  mrpService.getPlanningData = origGetPlanningData;
  mrpService.getAllSalesOrders = origGetAllSalesOrders;
  console.error = origConsoleError;
});

// ============================================================================
// 1. GET /api/mrp/run HTTP ENDPOINT TESTS
// ============================================================================

test("GET /api/mrp/run - returns 200 OK and success contract with full planning result", async () => {
  const mockPlanningResult = {
    planningDate: new Date("2026-07-20T00:00:00.000Z").toISOString(),
    salesOrders: [],
    explodedRequirements: [],
    netRequirements: [],
    allocatedRequirements: [],
    recommendations: [],
    summary: { recommendationCount: 0 },
  };

  mrpService.runPlanning = async () => mockPlanningResult;

  const response = await request(app)
    .get("/api/mrp/run")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, mockPlanningResult);
});

test("GET /api/mrp/run - passes query filters correctly to service layer", async () => {
  let receivedFilters = null;
  mrpService.runPlanning = async (filters) => {
    receivedFilters = filters;
    return { summary: {} };
  };

  await request(app)
    .get("/api/mrp/run?salesOrderIds=SO-100,SO-101&requiredDateFrom=2026-08-01&requiredDateTo=2026-08-31")
    .expect(200);

  assert.deepEqual(receivedFilters, {
    salesOrderIds: ["SO-100", "SO-101"],
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
  });
});

// ============================================================================
// 2. GET /api/mrp/planning-data HTTP ENDPOINT TESTS
// ============================================================================

test("GET /api/mrp/planning-data - returns 200 OK and success contract with raw planning dataset", async () => {
  const mockDataset = {
    demand: [{ demandId: "SO-1:1", salesOrderId: "SO-1" }],
    bom: { headers: [], lines: [] },
    items: [{ itemId: 100, itemCode: "FG-100" }],
  };

  mrpService.getPlanningData = async () => mockDataset;

  const response = await request(app)
    .get("/api/mrp/planning-data")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, mockDataset);
});

// ============================================================================
// 3. GET /api/mrp/sales-orders HTTP ENDPOINT TESTS
// ============================================================================

test("GET /api/mrp/sales-orders - returns 200 OK and success contract with demand sales order lines", async () => {
  const mockSalesOrders = [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100 },
  ];

  mrpService.getAllSalesOrders = async () => mockSalesOrders;

  const response = await request(app)
    .get("/api/mrp/sales-orders")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, mockSalesOrders);
});

// ============================================================================
// 4. HTTP VALIDATION ERROR TESTS (400 BAD REQUEST)
// ============================================================================

test("HTTP Validation - returns 400 Bad Request for invalid date query parameter", async () => {
  const response = await request(app)
    .get("/api/mrp/run?requiredDateFrom=invalid-date")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.ok(response.body.error.message.includes("ISO-8601"));
});

test("HTTP Validation - returns 400 Bad Request when requiredDateFrom > requiredDateTo", async () => {
  const response = await request(app)
    .get("/api/mrp/run?requiredDateFrom=2026-09-01&requiredDateTo=2026-08-01")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.equal(response.body.error.message, "requiredDateFrom cannot be later than requiredDateTo.");
});

// ============================================================================
// 5. DATA ACCESS & UNEXPECTED ERROR TESTS (500 INTERNAL SERVER ERROR)
// ============================================================================

test("HTTP Error Handling - returns 500 Internal Server Error for DataAccessError", async () => {
  mrpService.runPlanning = async () => {
    throw new DataAccessError("Database connection timed out");
  };

  const response = await request(app)
    .get("/api/mrp/run")
    .expect("Content-Type", /json/)
    .expect(500);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "DATA_ACCESS_ERROR");
  assert.equal(response.body.error.message, "Database connection timed out");
});

test("HTTP Error Handling - returns 500 Internal Server Error with sanitized generic message for unexpected exceptions", async () => {
  mrpService.runPlanning = async () => {
    throw new Error("Unhandled null pointer inside service pipeline");
  };

  const response = await request(app)
    .get("/api/mrp/run")
    .expect("Content-Type", /json/)
    .expect(500);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(response.body.error.message, "An unexpected internal server error occurred.");
});

// ============================================================================
// 6. ROUTE ACCESSIBILITY & HEADERS CONTRACT VERIFICATION
// ============================================================================

test("Route Verification - all MRP endpoints are registered and return JSON responses", async () => {
  mrpService.runPlanning = async () => ({ status: "ok" });
  mrpService.getPlanningData = async () => ({ status: "ok" });
  mrpService.getAllSalesOrders = async () => [];

  const res1 = await request(app).get("/api/mrp/run").expect(200);
  assert.equal(res1.headers["content-type"].includes("application/json"), true);

  const res2 = await request(app).get("/api/mrp/planning-data").expect(200);
  assert.equal(res2.headers["content-type"].includes("application/json"), true);

  const res3 = await request(app).get("/api/mrp/sales-orders").expect(200);
  assert.equal(res3.headers["content-type"].includes("application/json"), true);
});
