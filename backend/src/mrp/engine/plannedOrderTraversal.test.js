const test = require("node:test");
const assert = require("node:assert/strict");
const { traversePlannedOrders } = require("./plannedOrderTraversal");

function createContext(overrides = {}) {
  return {
    planningDate: new Date("2026-08-01T00:00:00.000Z"),
    demand: [{ salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 15, requiredDate: new Date("2026-08-20T00:00:00.000Z") }],
    items: [
      { itemId: 100, itemCode: "FG-100", baseUom: "PCS", procurementType: "PRODUCTION", manufacturingLeadTimeDays: 5 },
      { itemId: 200, itemCode: "RM-200", baseUom: "PCS", procurementType: "PURCHASE" },
    ],
    bom: {
      headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
      lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 2 }],
    },
    inventory: [],
    purchaseOrders: [],
    productionOrders: [],
    ...overrides,
  };
}

test("planned traversal suppresses children when finished-good inventory or supply covers demand", () => {
  const inventoryCovered = traversePlannedOrders(createContext({ inventory: [{ itemId: 100, availableQuantity: 15 }] }));
  assert.equal(inventoryCovered.recommendations.length, 0);
  assert.deepEqual(inventoryCovered.explodedRequirements.map((r) => r.itemId), [100]);

  const supplyCovered = traversePlannedOrders(createContext({
    productionOrders: [{ productionOrderId: "MO-1", itemId: 100, openQuantity: 15, expectedDate: new Date("2026-08-10") }],
  }));
  assert.equal(supplyCovered.recommendations.length, 0);
  assert.deepEqual(supplyCovered.explodedRequirements.map((r) => r.itemId), [100]);
});

test("planned traversal creates a finished-good order and uses its release date for children", () => {
  const result = traversePlannedOrders(createContext());
  const fg = result.recommendations.find((r) => r.itemId === 100);
  const rm = result.recommendations.find((r) => r.itemId === 200);
  const child = result.explodedRequirements.find((r) => r.itemId === 200);

  assert.equal(fg.recommendationType, "PRODUCTION");
  assert.equal(fg.quantity, 15);
  assert.equal(rm.quantity, 30);
  assert.equal(child.requiredDate.toISOString(), fg.plannedReleaseDate.toISOString());
});

test("planned traversal propagates final lot-sized quantities into direct children", () => {
  const cases = [
    { item: { lotSizingPolicy: "FOQ", fixedOrderQuantity: 100 }, expected: 200 },
    { item: { lotSizingPolicy: "MOQ", minimumOrderQuantity: 50 }, expected: 100 },
    { item: { lotSizingPolicy: "ORDER_MULTIPLE", orderMultiple: 20 }, expected: 40 },
  ];

  for (const scenario of cases) {
    const items = createContext().items;
    items[0] = { ...items[0], ...scenario.item };
    const result = traversePlannedOrders(createContext({ items }));
    const child = result.explodedRequirements.find((r) => r.itemId === 200);
    assert.equal(child.requiredQuantity, scenario.expected);
  }
});

test("planned traversal terminates at purchased items", () => {
  const context = createContext({
    items: [
      { itemId: 100, itemCode: "BUY-100", baseUom: "PCS", procurementType: "PURCHASE" },
      { itemId: 200, itemCode: "RM-200", baseUom: "PCS", procurementType: "PURCHASE" },
    ],
  });
  const result = traversePlannedOrders(context);

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].recommendationType, "PURCHASE");
  assert.deepEqual(result.explodedRequirements.map((r) => r.itemId), [100]);
});
