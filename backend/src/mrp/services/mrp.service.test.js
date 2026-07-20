const test = require("node:test");
const assert = require("node:assert/strict");

const repository = require("../repositories/mrp.repository");
const mrpService = require("./mrp.service");
const { ALLOWED_DEMAND_STATUSES } = require("../constants/planning.constants");
const { ValidationError, DataAccessError } = require("../errors/mrp.errors");

let origGetDemandOrderLines;
let origGetItems;
let origGetBomData;

test.beforeEach(() => {
  origGetDemandOrderLines = repository.getDemandOrderLines;
  origGetItems = repository.getItems;
  origGetBomData = repository.getBomData;
});

test.afterEach(() => {
  repository.getDemandOrderLines = origGetDemandOrderLines;
  repository.getItems = origGetItems;
  repository.getBomData = origGetBomData;
});

test("returns an empty planning dataset when no eligible demand exists", async () => {
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

test("returns validated planning data for eligible demand", async () => {
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
      { itemId: 101, itemCode: "FG-101", itemType: "FINISHED_GOOD", baseUom: "PCS" },
      { itemId: 201, itemCode: "RM-201", itemType: "RAW_MATERIAL", baseUom: "KG" },
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

test("throws ValidationError when a demanded finished good has no BOM", async () => {
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
    { itemId: 999, itemCode: "FG-999", itemType: "FINISHED_GOOD", baseUom: "PCS" },
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
