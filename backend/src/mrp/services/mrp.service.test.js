const test = require("node:test");
const assert = require("node:assert/strict");

const repository = require("../repositories/mrp.repository");
const mrpService = require("./mrp.service");
const { ALLOWED_DEMAND_STATUSES } = require("../constants/planning.constants");
const { ValidationError, DataAccessError } = require("../errors/mrp.errors");

let origGetDemandOrderLines;
let origGetItems;
let origGetBomData;
let origGetInventory;
let origGetOpenPurchaseOrders;
let origGetOpenProductionOrders;

test.beforeEach(() => {
  origGetDemandOrderLines = repository.getDemandOrderLines;
  origGetItems = repository.getItems;
  origGetBomData = repository.getBomData;
  origGetInventory = repository.getInventory;
  origGetOpenPurchaseOrders = repository.getOpenPurchaseOrders;
  origGetOpenProductionOrders = repository.getOpenProductionOrders;
});

test.afterEach(() => {
  repository.getDemandOrderLines = origGetDemandOrderLines;
  repository.getItems = origGetItems;
  repository.getBomData = origGetBomData;
  repository.getInventory = origGetInventory;
  repository.getOpenPurchaseOrders = origGetOpenPurchaseOrders;
  repository.getOpenProductionOrders = origGetOpenProductionOrders;
});

// ============================================================================
// 1. GETPLANNINGDATA BASELINE TESTS
// ============================================================================

test("returns an empty planning dataset when no eligible demand exists (getPlanningData)", async () => {
  let getDemandCalledWith = null;
  let getItemsCalled = false;
  let getBomCalled = false;

  repository.getDemandOrderLines = async (filters) => {
    getDemandCalledWith = filters;
    return [];
  };

  repository.getItems = async () => {
    getItemsCalled = true;
    return [];
  };

  repository.getBomData = async () => {
    getBomCalled = true;
    return { headers: [], lines: [] };
  };

  const result = await mrpService.getPlanningData();

  assert.deepEqual(result, {
    demand: [],
    bom: { headers: [], lines: [] },
    items: [],
  });

  assert.deepEqual(getDemandCalledWith.statuses, ALLOWED_DEMAND_STATUSES);
  assert.ok(!getItemsCalled);
  assert.ok(!getBomCalled);
});

test("returns validated planning data for eligible demand (getPlanningData)", async () => {
  let demandFiltersReceived = null;
  let getItemsCalled = false;
  let getBomCalled = false;

  repository.getDemandOrderLines = async (filters) => {
    demandFiltersReceived = filters;
    return [
      {
        demandId: "SO-2:1",
        salesOrderId: "SO-2",
        salesOrderLineId: 1,
        itemId: 101,
        quantity: 5,
        requiredDate: new Date("2026-08-15"),
        uom: "PCS",
      },
      {
        demandId: "SO-1:1",
        salesOrderId: "SO-1",
        salesOrderLineId: 1,
        itemId: 101,
        quantity: 10,
        requiredDate: new Date("2026-08-10"),
        uom: "PCS",
      },
    ];
  };

  repository.getItems = async () => {
    getItemsCalled = true;
    return [
      { itemId: 101, itemCode: "FG-101", procurementType: "PRODUCTION", baseUom: "PCS" },
      { itemId: 201, itemCode: "RM-201", procurementType: "PURCHASE", baseUom: "KG" },
    ];
  };

  repository.getBomData = async () => {
    getBomCalled = true;
    return {
      headers: [{ bomHeaderId: "BOM-101", parentItemId: 101 }],
      lines: [
        {
          bomLineId: 1,
          bomHeaderId: "BOM-101",
          parentItemId: 101,
          childItemId: 201,
          qtyPerParent: 2,
        },
      ],
    };
  };

  const result = await mrpService.getPlanningData({ requiredDateFrom: "2026-08-01" });

  assert.ok(getItemsCalled);
  assert.ok(getBomCalled);
  assert.deepEqual(demandFiltersReceived.statuses, ALLOWED_DEMAND_STATUSES);
  assert.equal(demandFiltersReceived.requiredDateFrom, "2026-08-01");

  assert.equal(result.demand.length, 2);
  assert.equal(result.demand[0].salesOrderId, "SO-1");
  assert.equal(result.demand[1].salesOrderId, "SO-2");
  assert.equal(result.items.length, 2);
  assert.equal(result.bom.headers.length, 1);
});

test("throws ValidationError when a demanded finished good has no BOM (getPlanningData)", async () => {
  repository.getDemandOrderLines = async () => [
    {
      demandId: "SO-1:1",
      salesOrderId: "SO-1",
      salesOrderLineId: 1,
      itemId: 999,
      quantity: 10,
      requiredDate: new Date("2026-08-10"),
      uom: "PCS",
    },
  ];

  repository.getItems = async () => [
    { itemId: 999, itemCode: "FG-999", procurementType: "PRODUCTION", baseUom: "PCS" },
  ];

  repository.getBomData = async () => ({
    headers: [],
    lines: [],
  });

  await assert.rejects(
    () => mrpService.getPlanningData(),
    (err) => err instanceof ValidationError && err.message.includes("does not have a Bill of Materials")
  );
});

test("propagates repository DataAccessError unchanged", async () => {
  const dataError = new DataAccessError("Database failure");
  repository.getDemandOrderLines = async () => {
    throw dataError;
  };

  await assert.rejects(
    () => mrpService.getPlanningData(),
    (err) => err === dataError
  );
});

// ============================================================================
// 2. ORCHESTRATION & REPOSITORY SEQUENCING TESTS (runPlanning)
// ============================================================================

test("runPlanning - invokes repository methods in strict deterministic sequence", async () => {
  const callSequence = [];

  repository.getDemandOrderLines = async () => {
    callSequence.push("getDemandOrderLines");
    return [
      {
        demandId: "SO-1:1",
        salesOrderId: "SO-1",
        salesOrderLineId: 1,
        itemId: 101,
        quantity: 10,
        requiredDate: new Date("2026-08-10"),
        uom: "PCS",
      },
    ];
  };

  repository.getItems = async () => {
    callSequence.push("getItems");
    return [
      { itemId: 101, itemCode: "FG-101", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
      { itemId: 201, itemCode: "RM-201", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
    ];
  };

  repository.getBomData = async () => {
    callSequence.push("getBomData");
    return {
      headers: [{ bomHeaderId: "BOM-101", parentItemId: 101 }],
      lines: [{ bomLineId: 1, bomHeaderId: "BOM-101", parentItemId: 101, childItemId: 201, qtyPerParent: 2 }],
    };
  };

  repository.getInventory = async () => {
    callSequence.push("getInventory");
    return [];
  };

  repository.getOpenPurchaseOrders = async () => {
    callSequence.push("getOpenPurchaseOrders");
    return [];
  };

  repository.getOpenProductionOrders = async () => {
    callSequence.push("getOpenProductionOrders");
    return [];
  };

  await mrpService.runPlanning();

  assert.deepEqual(callSequence, [
    "getDemandOrderLines",
    "getItems",
    "getBomData",
    "getInventory",
    "getOpenPurchaseOrders",
    "getOpenProductionOrders",
  ]);
});

test("runPlanning - short-circuits execution and skips secondary repository calls when demand is empty", async () => {
  let getItemsCalled = false;
  let getBomCalled = false;
  let getInventoryCalled = false;

  repository.getDemandOrderLines = async () => [];
  repository.getItems = async () => { getItemsCalled = true; return []; };
  repository.getBomData = async () => { getBomCalled = true; return { headers: [], lines: [] }; };
  repository.getInventory = async () => { getInventoryCalled = true; return []; };

  const result = await mrpService.runPlanning();

  assert.ok(!getItemsCalled);
  assert.ok(!getBomCalled);
  assert.ok(!getInventoryCalled);
  assert.equal(result.summary.salesOrderCount, 0);
  assert.equal(result.summary.recommendationCount, 0);
});

test("runPlanning - propagates supplied filters directly into repository.getDemandOrderLines()", async () => {
  let receivedFilters = null;

  repository.getDemandOrderLines = async (filters) => {
    receivedFilters = filters;
    return [];
  };

  const inputFilters = {
    salesOrderIds: ["SO-99"],
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
  };

  await mrpService.runPlanning(inputFilters);

  assert.deepEqual(receivedFilters, {
    salesOrderIds: ["SO-99"],
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
    statuses: ALLOWED_DEMAND_STATUSES,
  });
});

// ============================================================================
// 3. FAILURE & ERROR PROPAGATION TESTS
// ============================================================================

test("runPlanning - propagates repository DataAccessError from secondary loaders unchanged", async () => {
  const dbError = new DataAccessError("Failed loading inventory");

  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 101, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [{ itemId: 101, itemCode: "FG-101", procurementType: "PRODUCTION", baseUom: "PCS" }];
  repository.getBomData = async () => ({ headers: [{ bomHeaderId: "BOM-101", parentItemId: 101 }], lines: [] });
  repository.getInventory = async () => { throw dbError; };
  // _loadPlanningData starts all independent loaders with Promise.all. Keep the
  // failure path fully isolated from the real Prisma repository as well.
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  await assert.rejects(
    () => mrpService.runPlanning(),
    (err) => err === dbError
  );
});

// ============================================================================
// 4. SUMMARY RECONCILIATION & DETERMINISM TESTS
// ============================================================================

test("runPlanning - generates fully reconciled summary for zero shortages vs active recommendations", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 101, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 101, itemCode: "FG-101", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 201, itemCode: "RM-201", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-101", parentItemId: 101 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-101", parentItemId: 101, childItemId: 201, qtyPerParent: 2 }],
  });

  // Stock completely fulfills gross requirement (10 FG -> 20 RM)
  repository.getInventory = async () => [{ itemId: 201, availableQuantity: 50 }];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.explodedRequirements.length, 1);
  assert.equal(result.netRequirements.length, 1);
  assert.equal(result.netRequirements[0].netRequirement, 0);
  assert.equal(result.recommendations.length, 0);

  // Summary Reconciliation Assertion
  assert.equal(result.summary.recommendationCount, result.recommendations.length);
  assert.equal(result.summary.purchaseRecommendationCount, 0);
  assert.equal(result.summary.productionRecommendationCount, 0);
  assert.equal(result.summary.totalShortageQuantity, 0);
});

test("runPlanning - produces deterministic output and isolated planningDate across repeated calls", async () => {
  const demandMock = [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 101, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  const itemsMock = [
    { itemId: 101, itemCode: "FG-101", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 201, itemCode: "RM-201", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  const bomMock = {
    headers: [{ bomHeaderId: "BOM-101", parentItemId: 101 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-101", parentItemId: 101, childItemId: 201, qtyPerParent: 2 }],
  };

  repository.getDemandOrderLines = async () => demandMock;
  repository.getItems = async () => itemsMock;
  repository.getBomData = async () => bomMock;
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const run1 = await mrpService.runPlanning();
  const run2 = await mrpService.runPlanning();

  assert.ok(run1.planningDate instanceof Date);
  assert.ok(run2.planningDate instanceof Date);
  assert.deepEqual(run1.salesOrders, run2.salesOrders);
  assert.deepEqual(run1.explodedRequirements, run2.explodedRequirements);
  assert.deepEqual(run1.netRequirements, run2.netRequirements);
  assert.deepEqual(run1.allocatedRequirements, run2.allocatedRequirements);
  assert.deepEqual(run1.recommendations, run2.recommendations);
  assert.deepEqual(run1.summary, run2.summary);
});
