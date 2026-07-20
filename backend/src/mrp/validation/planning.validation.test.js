const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateItems,
  validateDemand,
  validateBom,
  sortDemand,
} = require("./planning.validation");
const { ValidationError } = require("../errors/mrp.errors");

test("validateItems - passes for valid item master list", () => {
  const items = [
    { itemId: 1, itemCode: "FG-001", itemType: "FINISHED_GOOD", baseUom: "PCS" },
    { itemId: 2, itemCode: "RM-001", itemType: "RAW_MATERIAL", baseUom: "KG" },
  ];

  assert.doesNotThrow(() => validateItems(items));
});

test("validateItems - throws ValidationError for null or undefined input", () => {
  assert.throws(
    () => validateItems(null),
    (err) => err instanceof ValidationError && err.message.includes("Items data must be an array")
  );

  assert.throws(
    () => validateItems(undefined),
    (err) => err instanceof ValidationError && err.message.includes("Items data must be an array")
  );
});

test("validateItems - throws ValidationError for missing itemId", () => {
  assert.throws(
    () => validateItems([{ itemCode: "FG-001", itemType: "FINISHED_GOOD", baseUom: "PCS" }]),
    (err) => err instanceof ValidationError && err.message.includes("missing itemId")
  );
});

test("validateItems - throws ValidationError for missing itemCode", () => {
  assert.throws(
    () => validateItems([{ itemId: 1, itemCode: "", itemType: "FINISHED_GOOD", baseUom: "PCS" }]),
    (err) => err instanceof ValidationError && err.message.includes("missing a valid itemCode")
  );
});

test("validateItems - throws ValidationError for missing itemType", () => {
  assert.throws(
    () => validateItems([{ itemId: 1, itemCode: "FG-001", itemType: " ", baseUom: "PCS" }]),
    (err) => err instanceof ValidationError && err.message.includes("missing a valid itemType")
  );
});

test("validateItems - throws ValidationError for missing baseUom", () => {
  assert.throws(
    () => validateItems([{ itemId: 1, itemCode: "FG-001", itemType: "FINISHED_GOOD", baseUom: "" }]),
    (err) => err instanceof ValidationError && err.message.includes("missing a valid baseUom")
  );
});

test("validateDemand - passes for valid demand lines", () => {
  const demand = [
    {
      demandId: "SO-1:1",
      salesOrderId: "SO-1",
      salesOrderLineId: 1,
      itemId: 100,
      quantity: 10,
      requiredDate: new Date("2026-08-01"),
      uom: "PCS",
    },
  ];

  assert.doesNotThrow(() => validateDemand(demand));
});

test("validateDemand - throws ValidationError for null or undefined input", () => {
  assert.throws(
    () => validateDemand(null),
    (err) => err instanceof ValidationError && err.message.includes("Demand data must be an array")
  );

  assert.throws(
    () => validateDemand(undefined),
    (err) => err instanceof ValidationError && err.message.includes("Demand data must be an array")
  );
});

test("validateDemand - throws ValidationError for missing itemId", () => {
  assert.throws(
    () => validateDemand([{ demandId: "D1", quantity: 10, requiredDate: new Date() }]),
    (err) => err instanceof ValidationError && err.message.includes("missing itemId")
  );
});

test("validateDemand - throws ValidationError for missing or invalid requiredDate", () => {
  assert.throws(
    () => validateDemand([{ demandId: "D1", itemId: 100, quantity: 10, requiredDate: "invalid-date" }]),
    (err) => err instanceof ValidationError && err.message.includes("missing a valid requiredDate")
  );
});

test("validateDemand - throws ValidationError for non-positive quantity", () => {
  assert.throws(
    () => validateDemand([{ demandId: "D1", itemId: 100, quantity: 0, requiredDate: new Date() }]),
    (err) => err instanceof ValidationError && err.message.includes("Quantity must be greater than zero")
  );

  assert.throws(
    () => validateDemand([{ demandId: "D1", itemId: 100, quantity: -5, requiredDate: new Date() }]),
    (err) => err instanceof ValidationError && err.message.includes("Quantity must be greater than zero")
  );
});

test("validateBom - passes when all demand finished goods have BOM, qtyPerParent > 0, and child items exist", () => {
  const items = [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", baseUom: "KG" },
  ];
  const demand = [{ itemId: 100, quantity: 5, requiredDate: new Date() }];
  const bom = {
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [
      {
        bomLineId: 1,
        bomHeaderId: "BOM-100",
        parentItemId: 100,
        childItemId: 200,
        qtyPerParent: 2,
      },
    ],
  };

  assert.doesNotThrow(() => validateBom(bom, demand, items));
});

test("validateBom - throws ValidationError for null or invalid BOM structure", () => {
  assert.throws(
    () => validateBom(null, [], []),
    (err) => err instanceof ValidationError && err.message.includes("BOM data must contain headers and lines arrays")
  );

  assert.throws(
    () => validateBom({}, [], []),
    (err) => err instanceof ValidationError && err.message.includes("BOM data must contain headers and lines arrays")
  );
});

test("validateBom - throws ValidationError if demanded finished good is missing a BOM", () => {
  const items = [{ itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", baseUom: "PCS" }];
  const demand = [{ itemId: 100, quantity: 5, requiredDate: new Date() }];
  const bom = { headers: [], lines: [] };

  assert.throws(
    () => validateBom(bom, demand, items),
    (err) => err instanceof ValidationError && err.message.includes("does not have a Bill of Materials")
  );
});

test("validateBom - throws ValidationError if qtyPerParent <= 0", () => {
  const items = [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", baseUom: "KG" },
  ];
  const demand = [{ itemId: 100, quantity: 5, requiredDate: new Date() }];
  const bom = {
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [
      {
        bomLineId: 1,
        bomHeaderId: "BOM-100",
        parentItemId: 100,
        childItemId: 200,
        qtyPerParent: 0,
      },
    ],
  };

  assert.throws(
    () => validateBom(bom, demand, items),
    (err) => err instanceof ValidationError && err.message.includes("qtyPerParent greater than zero")
  );
});

test("validateBom - throws ValidationError if BOM child item does not exist in item master", () => {
  const items = [{ itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", baseUom: "PCS" }];
  const demand = [{ itemId: 100, quantity: 5, requiredDate: new Date() }];
  const bom = {
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [
      {
        bomLineId: 1,
        bomHeaderId: "BOM-100",
        parentItemId: 100,
        childItemId: 999,
        qtyPerParent: 1,
      },
    ],
  };

  assert.throws(
    () => validateBom(bom, demand, items),
    (err) => err instanceof ValidationError && err.message.includes("BOM child item 999 does not exist")
  );
});

test("sortDemand - sorts demand by requiredDate, salesOrderId, and salesOrderLineId without mutating original array", () => {
  const original = [
    { salesOrderId: "SO-002", salesOrderLineId: 1, requiredDate: "2026-08-10" },
    { salesOrderId: "SO-001", salesOrderLineId: 2, requiredDate: "2026-08-01" },
    { salesOrderId: "SO-001", salesOrderLineId: 1, requiredDate: "2026-08-01" },
  ];

  const originalCopy = JSON.stringify(original);
  const sorted = sortDemand(original);

  assert.equal(JSON.stringify(original), originalCopy);
  assert.notEqual(sorted, original);

  assert.equal(sorted[0].salesOrderId, "SO-001");
  assert.equal(sorted[0].salesOrderLineId, 1);
  assert.equal(sorted[1].salesOrderId, "SO-001");
  assert.equal(sorted[1].salesOrderLineId, 2);
  assert.equal(sorted[2].salesOrderId, "SO-002");
});
