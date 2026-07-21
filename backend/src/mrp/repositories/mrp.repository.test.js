const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../../lib/prisma");
const repository = require("./mrp.repository");
const { DataAccessError } = require("../errors/mrp.errors");

let originalSalesOrderLineFindMany;
let originalBOMHeaderFindMany;
let originalItemFindMany;
let originalPurchaseOrderLineFindMany;
let originalProductionOrderFindMany;

test.beforeEach(() => {
  originalSalesOrderLineFindMany = prisma.salesOrderLine.findMany;
  originalBOMHeaderFindMany = prisma.bOMHeader.findMany;
  originalItemFindMany = prisma.item.findMany;
  originalPurchaseOrderLineFindMany = prisma.purchaseOrderLine?.findMany;
  originalProductionOrderFindMany = prisma.productionOrder?.findMany;
});

test.afterEach(() => {
  prisma.salesOrderLine.findMany = originalSalesOrderLineFindMany;
  prisma.bOMHeader.findMany = originalBOMHeaderFindMany;
  prisma.item.findMany = originalItemFindMany;
  if (prisma.purchaseOrderLine) prisma.purchaseOrderLine.findMany = originalPurchaseOrderLineFindMany;
  if (prisma.productionOrder) prisma.productionOrder.findMany = originalProductionOrderFindMany;
});

// ============================================================================
// 1. HAPPY PATH DOMAIN MAPPING TESTS
// ============================================================================

test("maps sales order lines to demand objects", async () => {
  prisma.salesOrderLine.findMany = async () => [
    {
      salesOrderLineId: 10,
      salesOrderId: "SO-100",
      productId: 501,
      quantity: 25,
      product: { uom: "PCS" },
      salesOrder: { orderDate: new Date("2026-07-19T00:00:00.000Z") },
    },
  ];

  const rows = await repository.getDemandOrderLines();

  assert.deepEqual(rows, [
    {
      demandId: "SO-100:10",
      salesOrderId: "SO-100",
      salesOrderLineId: 10,
      itemId: 501,
      quantity: 25,
      requiredDate: new Date("2026-07-19T00:00:00.000Z"),
      uom: "PCS",
    },
  ]);
});

test("maps BOM headers and lines to domain objects", async () => {
  prisma.bOMHeader.findMany = async () => [
    {
      bomId: "BOM-01",
      finishedGoodId: 1001,
      bomLines: [{ bomLineId: 1, bomId: "BOM-01", materialId: 2001, quantityRequired: 2.5 }],
    },
  ];

  const result = await repository.getBomData();

  assert.deepEqual(result, {
    headers: [{ bomHeaderId: "BOM-01", parentItemId: 1001 }],
    lines: [
      {
        bomLineId: 1,
        bomHeaderId: "BOM-01",
        parentItemId: 1001,
        childItemId: 2001,
        qtyPerParent: 2.5,
      },
    ],
  });
});

test("maps item records to domain objects", async () => {
  prisma.item.findMany = async () => [
    { itemId: 1, itemCode: "FG-100", category: "FINISHED_GOOD", uom: "PCS" },
  ];

  const items = await repository.getItems();

  assert.deepEqual(items, [
    {
      itemId: 1,
      itemCode: "FG-100",
      itemType: "FINISHED_GOOD",
      baseUom: "PCS",
    },
  ]);
});

test("maps item records with explicit procurementType to domain objects", async () => {
  prisma.item.findMany = async () => [
    { itemId: 2, itemCode: "RM-200", category: "RAW_MATERIAL", procurementType: "PURCHASE", uom: "KG" },
  ];

  const items = await repository.getItems();

  assert.deepEqual(items, [
    {
      itemId: 2,
      itemCode: "RM-200",
      itemType: "RAW_MATERIAL",
      procurementType: "PURCHASE",
      baseUom: "KG",
    },
  ]);
});

test("maps inventory stock records to domain objects", async () => {
  prisma.item.findMany = async () => [
    { itemId: 501, currentStock: 150, reorderLevel: 20 },
  ];

  const inventory = await repository.getInventory();

  assert.deepEqual(inventory, [
    {
      itemId: 501,
      availableQuantity: 150,
      onHandQuantity: 150,
      reorderLevel: 20,
    },
  ]);
});

test("maps null currentStock and reorderLevel to 0 fallbacks for inventory", async () => {
  prisma.item.findMany = async () => [
    { itemId: 502, currentStock: null, reorderLevel: null },
  ];

  const inventory = await repository.getInventory();

  assert.deepEqual(inventory, [
    {
      itemId: 502,
      availableQuantity: 0,
      onHandQuantity: 0,
      reorderLevel: 0,
    },
  ]);
});

test("maps open purchase order lines to supply records", async () => {
  if (!prisma.purchaseOrderLine) prisma.purchaseOrderLine = {};
  prisma.purchaseOrderLine.findMany = async () => [
    {
      purchaseOrderLineId: 101,
      purchaseOrderId: "PO-10",
      materialId: 301,
      quantity: 50,
      purchaseOrder: { orderDate: new Date("2026-08-01") },
    },
  ];

  const poList = await repository.getOpenPurchaseOrders();

  assert.deepEqual(poList, [
    {
      purchaseOrderId: "PO-10",
      purchaseOrderLineId: 101,
      itemId: 301,
      openQuantity: 50,
      expectedDate: new Date("2026-08-01"),
    },
  ]);
});

test("maps open production orders to supply records", async () => {
  if (!prisma.productionOrder) prisma.productionOrder = {};
  prisma.productionOrder.findMany = async () => [
    {
      productionOrderId: "MO-20",
      productId: 201,
      quantity: 30,
      startDate: new Date("2026-08-05"),
    },
  ];

  const moList = await repository.getOpenProductionOrders();

  assert.deepEqual(moList, [
    {
      productionOrderId: "MO-20",
      itemId: 201,
      openQuantity: 30,
      expectedDate: new Date("2026-08-05"),
    },
  ]);
});

// ============================================================================
// 2. EMPTY DATASET BOUNDARY TESTS
// ============================================================================

test("returns empty collections when Prisma finds no records across all repository methods", async () => {
  prisma.salesOrderLine.findMany = async () => [];
  prisma.bOMHeader.findMany = async () => [];
  prisma.item.findMany = async () => [];
  if (!prisma.purchaseOrderLine) prisma.purchaseOrderLine = {};
  prisma.purchaseOrderLine.findMany = async () => [];
  if (!prisma.productionOrder) prisma.productionOrder = {};
  prisma.productionOrder.findMany = async () => [];

  assert.deepEqual(await repository.getDemandOrderLines(), []);
  assert.deepEqual(await repository.getBomData(), { headers: [], lines: [] });
  assert.deepEqual(await repository.getItems(), []);
  assert.deepEqual(await repository.getInventory(), []);
  assert.deepEqual(await repository.getOpenPurchaseOrders(), []);
  assert.deepEqual(await repository.getOpenProductionOrders(), []);
});

// ============================================================================
// 3. QUERY SHAPE & FILTER NORMALIZATION TESTS
// ============================================================================

test("builds correct Prisma where clause and normalizes status whitespace", async () => {
  let capturedArgs = null;
  prisma.salesOrderLine.findMany = async (args) => {
    capturedArgs = args;
    return [];
  };

  await repository.getDemandOrderLines({
    statuses: [" OPEN ", " RELEASED ", " "],
    salesOrderIds: ["SO-001", "SO-002"],
    requiredDateFrom: "2026-08-01",
    requiredDateTo: "2026-08-31",
  });

  assert.ok(capturedArgs);
  assert.ok(capturedArgs.where.salesOrder);
  assert.deepEqual(capturedArgs.where.salesOrder.status.in, ["OPEN", "RELEASED"]);
  assert.deepEqual(capturedArgs.where.salesOrder.salesOrderId.in, ["SO-001", "SO-002"]);
  assert.equal(capturedArgs.where.salesOrder.orderDate.gte.toISOString(), new Date("2026-08-01").toISOString());
  assert.equal(capturedArgs.where.salesOrder.orderDate.lte.toISOString(), new Date("2026-08-31").toISOString());
});

test("verifies Prisma select shape for getOpenPurchaseOrders and getOpenProductionOrders", async () => {
  let poArgs = null;
  let moArgs = null;

  if (!prisma.purchaseOrderLine) prisma.purchaseOrderLine = {};
  prisma.purchaseOrderLine.findMany = async (args) => {
    poArgs = args;
    return [];
  };

  if (!prisma.productionOrder) prisma.productionOrder = {};
  prisma.productionOrder.findMany = async (args) => {
    moArgs = args;
    return [];
  };

  await repository.getOpenPurchaseOrders();
  await repository.getOpenProductionOrders();

  assert.deepEqual(poArgs.where.purchaseOrder.status.in, ["OPEN", "RELEASED", "APPROVED", "CONFIRMED"]);
  assert.ok(poArgs.select.purchaseOrderId);
  assert.ok(poArgs.select.materialId);

  assert.deepEqual(moArgs.where.status.in, ["OPEN", "RELEASED", "IN_PROGRESS", "PLANNED"]);
  assert.ok(moArgs.select.productionOrderId);
  assert.ok(moArgs.select.productId);
});

// ============================================================================
// 4. IMMUTABILITY & ORIGINAL OBJECT PROTECTION
// ============================================================================

test("guarantees repository methods never mutate mock Prisma response objects", async () => {
  const dbData = [
    {
      salesOrderLineId: 10,
      salesOrderId: "SO-100",
      productId: 501,
      quantity: 25,
      product: { uom: "PCS" },
      salesOrder: { orderDate: new Date("2026-07-19T00:00:00.000Z") },
    },
  ];

  const baseline = structuredClone(dbData);
  prisma.salesOrderLine.findMany = async () => dbData;

  const result = await repository.getDemandOrderLines();

  assert.deepEqual(dbData, baseline);
  assert.notEqual(result[0], dbData[0]);
});

// ============================================================================
// 5. COMPREHENSIVE ERROR WRAPPING TESTS
// ============================================================================

test("wraps Prisma failures in DataAccessError across all repository methods", async () => {
  const dbFailure = new Error("Database connection lost");

  prisma.salesOrderLine.findMany = async () => { throw dbFailure; };
  prisma.bOMHeader.findMany = async () => { throw dbFailure; };
  prisma.item.findMany = async () => { throw dbFailure; };
  if (!prisma.purchaseOrderLine) prisma.purchaseOrderLine = {};
  prisma.purchaseOrderLine.findMany = async () => { throw dbFailure; };
  if (!prisma.productionOrder) prisma.productionOrder = {};
  prisma.productionOrder.findMany = async () => { throw dbFailure; };

  await assert.rejects(repository.getDemandOrderLines(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });

  await assert.rejects(repository.getBomData(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });

  await assert.rejects(repository.getItems(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });

  await assert.rejects(repository.getInventory(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });

  await assert.rejects(repository.getOpenPurchaseOrders(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });

  await assert.rejects(repository.getOpenProductionOrders(), (err) => {
    return err instanceof DataAccessError && err.cause === dbFailure;
  });
});
