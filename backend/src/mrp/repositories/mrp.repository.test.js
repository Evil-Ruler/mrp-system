const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../../lib/prisma");
const repository = require("./mrp.repository");
const { DataAccessError } = require("../errors/mrp.errors");

let originalSalesOrderLineFindMany;
let originalBOMHeaderFindMany;
let originalItemFindMany;

test.beforeEach(() => {
  originalSalesOrderLineFindMany = prisma.salesOrderLine.findMany;
  originalBOMHeaderFindMany = prisma.bOMHeader.findMany;
  originalItemFindMany = prisma.item.findMany;
});

test.afterEach(() => {
  prisma.salesOrderLine.findMany = originalSalesOrderLineFindMany;
  prisma.bOMHeader.findMany = originalBOMHeaderFindMany;
  prisma.item.findMany = originalItemFindMany;
});

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

test("wraps Prisma failures in DataAccessError", async () => {
  prisma.item.findMany = async () => {
    throw new Error("db down");
  };

  await assert.rejects(repository.getItems(), (error) => {
    assert.ok(error instanceof DataAccessError);
    assert.equal(error.message, "Failed to load item master records for MRP.");
    assert.ok(error.cause instanceof Error);
    return true;
  });
});
