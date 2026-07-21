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

test("maps item records to narrow domain objects", async () => {
  prisma.item.findMany = async () => [
    { itemId: 1, itemCode: "FG-100", category: "FINISHED_GOOD", uom: "PCS" },
  ];

  const items = await repository.getItems();

  assert.deepEqual(items, [
    {
      itemId: 1,
      itemCode: "FG-100",
      baseUom: "PCS",
      procurementType: "PRODUCTION",
    },
  ]);
});

test("derives procurementType from category via resolver when no explicit value is present", async () => {
  prisma.item.findMany = async () => [
    { itemId: 1, itemCode: "FG-1", category: "Finished Good", uom: "PCS" },
    { itemId: 2, itemCode: "RM-1", category: "Raw Material", uom: "KG" },
    { itemId: 3, itemCode: "HW-1", category: "Hardware", uom: "PCS" },
    { itemId: 4, itemCode: "CN-1", category: "Consumable", uom: "L" },
    { itemId: 5, itemCode: "SA-1", category: "Sub Assembly", uom: "PCS" },
    { itemId: 6, itemCode: "PSA-1", category: "Purchased Sub-Assembly", uom: "PCS" },
  ];

  const items = await repository.getItems();

  assert.equal(items.find((i) => i.itemId === 1).procurementType, "PRODUCTION");
  assert.equal(items.find((i) => i.itemId === 2).procurementType, "PURCHASE");
  assert.equal(items.find((i) => i.itemId === 3).procurementType, "PURCHASE");
  assert.equal(items.find((i) => i.itemId === 4).procurementType, "PURCHASE");
  assert.equal(items.find((i) => i.itemId === 5).procurementType, "PRODUCTION");
  assert.equal(items.find((i) => i.itemId === 6).procurementType, "PURCHASE");
});

test("maps item records with explicit valid procurementType to domain objects", async () => {
  prisma.item.findMany = async () => [
    { itemId: 2, itemCode: "RM-200", category: "RAW_MATERIAL", procurementType: "PURCHASE", uom: "KG" },
    { itemId: 3, itemCode: "SA-300", category: "RAW_MATERIAL", procurementType: "PRODUCTION", uom: "PCS" },
  ];

  const items = await repository.getItems();

  assert.deepEqual(items, [
    {
      itemId: 2,
      itemCode: "RM-200",
      baseUom: "KG",
      procurementType: "PURCHASE",
    },
    {
      itemId: 3,
      itemCode: "SA-300",
      baseUom: "PCS",
      procurementType: "PRODUCTION",
    },
  ]);
});

test("throws DataAccessError when persisted item record has invalid explicit procurementType", async () => {
  prisma.item.findMany = async () => [
    { itemId: 10, itemCode: "ITEM-INVALID", category: "FINISHED_GOOD", procurementType: "INVALID_STRATEGY", uom: "PCS" },
  ];

  await assert.rejects(repository.getItems(), (err) => {
    return err instanceof DataAccessError && err.message.includes("Invalid explicit procurementType");
  });
});

test("throws DataAccessError when persisted item record has unknown category and missing procurementType", async () => {
  prisma.item.findMany = async () => [
    { itemId: 11, itemCode: "UNKNOWN-CAT", category: "UNSUPPORTED_CATEGORY", uom: "PCS" },
  ];

  await assert.rejects(repository.getItems(), (err) => {
    return err instanceof DataAccessError && err.message.includes("unknown category");
  });
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
// REPOSITORY CONTRACT: every select must project the fields its mapper consumes
// (guards the mapper/select drift that previously hid missing procurementType
// derivation input and the dropped purchaseOrderLineId).
// ============================================================================

test("select clauses request every field the domain mappers consume", async () => {
  const itemSelects = [];
  let demandSelect;
  let bomSelect;
  let poSelect;
  let moSelect;

  prisma.item.findMany = async (a) => { itemSelects.push(a.select); return []; };
  prisma.salesOrderLine.findMany = async (a) => { demandSelect = a.select; return []; };
  prisma.bOMHeader.findMany = async (a) => { bomSelect = a.select; return []; };
  if (!prisma.purchaseOrderLine) prisma.purchaseOrderLine = {};
  prisma.purchaseOrderLine.findMany = async (a) => { poSelect = a.select; return []; };
  if (!prisma.productionOrder) prisma.productionOrder = {};
  prisma.productionOrder.findMany = async (a) => { moSelect = a.select; return []; };

  await repository.getDemandOrderLines();
  await repository.getItems();      // itemSelects[0]
  await repository.getInventory();  // itemSelects[1]
  await repository.getBomData();
  await repository.getOpenPurchaseOrders();
  await repository.getOpenProductionOrders();

  // Demand mapper reads: salesOrderLineId, salesOrderId, productId, quantity, product.uom, salesOrder.orderDate
  assert.ok(demandSelect.salesOrderLineId && demandSelect.salesOrderId && demandSelect.productId && demandSelect.quantity);
  assert.ok(demandSelect.product && demandSelect.product.select.uom);
  assert.ok(demandSelect.salesOrder && demandSelect.salesOrder.select.orderDate);

  // Item mapper reads category (source for itemType and derived procurementType); it must
  // NOT select a non-existent procurementType column (that would break the query).
  const itemSelect = itemSelects[0];
  assert.ok(itemSelect.itemId && itemSelect.itemCode && itemSelect.category && itemSelect.uom);
  assert.equal(itemSelect.procurementType, undefined);

  // Inventory mapper reads: itemId, currentStock, reorderLevel
  const invSelect = itemSelects[1];
  assert.ok(invSelect.itemId && invSelect.currentStock && invSelect.reorderLevel);

  // BOM mappers read header.bomId, header.finishedGoodId and line.{bomLineId,bomId,materialId,quantityRequired}
  assert.ok(bomSelect.bomId && bomSelect.finishedGoodId && bomSelect.bomLines);
  const lineSelect = bomSelect.bomLines.select;
  assert.ok(lineSelect.bomLineId && lineSelect.bomId && lineSelect.materialId && lineSelect.quantityRequired);

  // Purchase supply mapper reads purchaseOrderId, purchaseOrderLineId, materialId, quantity, purchaseOrder.orderDate
  assert.ok(poSelect.purchaseOrderId && poSelect.purchaseOrderLineId && poSelect.materialId && poSelect.quantity);
  assert.ok(poSelect.purchaseOrder && poSelect.purchaseOrder.select.orderDate);

  // Production supply mapper reads productionOrderId, productId, quantity, startDate
  assert.ok(moSelect.productionOrderId && moSelect.productId && moSelect.quantity && moSelect.startDate);
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
