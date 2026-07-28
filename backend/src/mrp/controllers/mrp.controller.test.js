const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("./mrp.controller");
const mrpService = require("../services/mrp.service");
const { ValidationError, DataAccessError } = require("../errors/mrp.errors");

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

let origRunPlanning;
let origGetPlanningData;
let origGetAllSalesOrders;
let origConsoleError;

test.beforeEach(() => {
  origRunPlanning = mrpService.runPlanning;
  origGetPlanningData = mrpService.getPlanningData;
  origGetAllSalesOrders = mrpService.getAllSalesOrders;
  origConsoleError = console.error;
});

test.afterEach(() => {
  mrpService.runPlanning = origRunPlanning;
  mrpService.getPlanningData = origGetPlanningData;
  mrpService.getAllSalesOrders = origGetAllSalesOrders;
  console.error = origConsoleError;
});

test("runPlanning controller - returns 200 OK with formatted JSON response", async () => {
  const mockResult = {
    planningDate: new Date("2026-07-20"),
    salesOrders: [],
    explodedRequirements: [],
    netRequirements: [],
    allocatedRequirements: [],
    recommendations: [],
    summary: { recommendationCount: 0 },
  };

  mrpService.runPlanning = async (filters) => mockResult;

  const req = { query: { salesOrderIds: "SO-100" } };
  const res = createMockRes();

  await controller.runPlanning(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, mockResult);
});

test("runPlanning controller - maps ValidationError to 400 Bad Request", async () => {
  const req = { query: { requiredDateFrom: "invalid" } };
  const res = createMockRes();

  await controller.runPlanning(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("runPlanning controller - maps DataAccessError to 500 Internal Server Error", async () => {
  mrpService.runPlanning = async () => {
    throw new DataAccessError("Database connection lost");
  };

  const req = { query: {} };
  const res = createMockRes();

  await controller.runPlanning(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "DATA_ACCESS_ERROR");
  assert.equal(res.body.error.message, "Database connection lost");
});

test("runPlanning controller - masks unexpected internal error messages and logs exception", async () => {
  let loggedError = null;
  console.error = (err) => {
    loggedError = err;
  };

  const internalErr = new TypeError("Cannot read properties of undefined (reading 'foo')");
  mrpService.runPlanning = async () => {
    throw internalErr;
  };

  const req = { query: {} };
  const res = createMockRes();

  await controller.runPlanning(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(res.body.error.message, "An unexpected internal server error occurred.");
  assert.equal(loggedError, internalErr);
});

test("getPlanningData controller - returns 200 OK with formatted JSON response", async () => {
  const mockData = { demand: [], bom: { headers: [], lines: [] }, items: [] };
  mrpService.getPlanningData = async () => mockData;

  const req = { query: {} };
  const res = createMockRes();

  await controller.getPlanningData(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, mockData);
});

test("getAllSalesOrders controller - returns 200 OK with formatted JSON response", async () => {
  const mockOrders = [{ demandId: "SO-1:1", salesOrderId: "SO-1" }];
  mrpService.getAllSalesOrders = async () => mockOrders;

  const req = { query: {} };
  const res = createMockRes();

  await controller.getAllSalesOrders(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, mockOrders);
});
