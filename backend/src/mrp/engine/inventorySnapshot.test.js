const test = require("node:test");
const assert = require("node:assert/strict");

const { createInventorySnapshot } = require("./inventorySnapshot");

test("returns an empty array when given an empty inventory array", () => {
  const input = [];
  const result = createInventorySnapshot(input);

  assert.deepEqual(result, []);
  assert.notEqual(result, input);
});

test("returns new object instances with exact preserved field values for a single record", () => {
  const input = [
    {
      itemId: 101,
      availableQuantity: 50,
      onHandQuantity: 50,
      reorderLevel: 10,
    },
  ];

  const result = createInventorySnapshot(input);

  assert.deepEqual(result, [
    {
      itemId: 101,
      availableQuantity: 50,
      onHandQuantity: 50,
      reorderLevel: 10,
    },
  ]);
  assert.notEqual(result, input);
  assert.notEqual(result[0], input[0]);
});

test("preserves input ordering and field values across multiple inventory records", () => {
  const input = [
    { itemId: 100, availableQuantity: 25, onHandQuantity: 25, reorderLevel: 5 },
    { itemId: 200, availableQuantity: 80, onHandQuantity: 100, reorderLevel: 15 },
    { itemId: 300, availableQuantity: 0, onHandQuantity: 0, reorderLevel: 0 },
  ];

  const result = createInventorySnapshot(input);

  assert.equal(result.length, 3);
  assert.equal(result[0].itemId, 100);
  assert.equal(result[1].itemId, 200);
  assert.equal(result[2].itemId, 300);
  assert.deepEqual(result, input);
  assert.notEqual(result[0], input[0]);
  assert.notEqual(result[1], input[1]);
  assert.notEqual(result[2], input[2]);
});

test("guarantees input array and input objects are not mutated", () => {
  const input = [
    { itemId: 500, availableQuantity: 15, onHandQuantity: 15, reorderLevel: 2 },
  ];
  const inputCopy = structuredClone(input);

  createInventorySnapshot(input);

  assert.deepEqual(input, inputCopy);
});
