const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateDemandRequirement,
  calculateSafetyStockRequirement,
  calculateEffectiveNetRequirement,
  applySafetyStockPolicy,
} = require("./safetyStockPolicy");

// ============================================================================
// 1. PURE CALCULATION FUNCTION TESTS
// ============================================================================

test("calculateDemandRequirement - calculates shortage correctly", () => {
  assert.equal(calculateDemandRequirement(100, 40), 60);
  assert.equal(calculateDemandRequirement(100, 100), 0);
  assert.equal(calculateDemandRequirement(50, 100), 0);
  assert.equal(calculateDemandRequirement(-10, 50), 0);
});

test("calculateSafetyStockRequirement - calculates safety stock buffer deficit correctly", () => {
  assert.equal(calculateSafetyStockRequirement(10, 20), 10);
  assert.equal(calculateSafetyStockRequirement(20, 20), 0);
  assert.equal(calculateSafetyStockRequirement(150, 20), 0);
  assert.equal(calculateSafetyStockRequirement(0, 25), 25);
});

test("calculateEffectiveNetRequirement - combines demand shortage and safety stock deficit", () => {
  assert.equal(calculateEffectiveNetRequirement(40, 15), 55);
  assert.equal(calculateEffectiveNetRequirement(0, 25), 25);
  assert.equal(calculateEffectiveNetRequirement(10, 0), 10);
  assert.equal(calculateEffectiveNetRequirement(0, 0), 0);
});

// ============================================================================
// 2. STAGE 2B POLICY APPLICATION TESTS
// ============================================================================

test("applySafetyStockPolicy - Example A: Demand equals stock, safety stock buffer required", () => {
  // Current Stock = 100, Demand = 100, Safety Stock = 25 -> Effective Net = 25
  const netReqs = [
    {
      demandSourceType: "SALES_ORDER",
      salesOrderId: "SO-1",
      salesOrderLineId: 1,
      itemId: 101,
      grossRequirement: 100,
      availableInventoryUsed: 100,
      netRequirement: 0,
      requiredDate: new Date("2026-08-10"),
      bomLevel: 0,
      path: [101],
    },
  ];

  const inventory = [{ itemId: 101, availableQuantity: 100 }];
  const items = [{ itemId: 101, itemCode: "ITEM-A", safetyStock: 25 }];

  const results = applySafetyStockPolicy(netReqs, inventory, items);

  assert.equal(results.length, 1);
  assert.equal(results[0].demandRequirement, 0);
  assert.equal(results[0].safetyStockDeficit, 25);
  assert.equal(results[0].netRequirement, 25);
});

test("applySafetyStockPolicy - Example B: Partial stock available, safety buffer protected", () => {
  // Current Stock = 100, Demand = 90, Safety Stock = 20 -> Effective Net = 10
  const netReqs = [
    {
      demandSourceType: "SALES_ORDER",
      salesOrderId: "SO-2",
      salesOrderLineId: 1,
      itemId: 102,
      grossRequirement: 90,
      availableInventoryUsed: 90,
      netRequirement: 0,
      requiredDate: new Date("2026-08-10"),
      bomLevel: 0,
      path: [102],
    },
  ];

  const inventory = [{ itemId: 102, availableQuantity: 100 }];
  const items = [{ itemId: 102, itemCode: "ITEM-B", safetyStock: 20 }];

  const results = applySafetyStockPolicy(netReqs, inventory, items);

  assert.equal(results.length, 1);
  assert.equal(results[0].demandRequirement, 0);
  assert.equal(results[0].safetyStockDeficit, 10);
  assert.equal(results[0].netRequirement, 10);
});

test("applySafetyStockPolicy - Example C: Excess stock above buffer", () => {
  // Current Stock = 200, Demand = 50, Safety Stock = 20 -> Effective Net = 0
  const netReqs = [
    {
      demandSourceType: "SALES_ORDER",
      salesOrderId: "SO-3",
      salesOrderLineId: 1,
      itemId: 103,
      grossRequirement: 50,
      availableInventoryUsed: 50,
      netRequirement: 0,
      requiredDate: new Date("2026-08-10"),
      bomLevel: 0,
      path: [103],
    },
  ];

  const inventory = [{ itemId: 103, availableQuantity: 200 }];
  const items = [{ itemId: 103, itemCode: "ITEM-C", safetyStock: 20 }];

  const results = applySafetyStockPolicy(netReqs, inventory, items);

  assert.equal(results.length, 1);
  assert.equal(results[0].demandRequirement, 0);
  assert.equal(results[0].safetyStockDeficit, 0);
  assert.equal(results[0].netRequirement, 0);
});

test("applySafetyStockPolicy - Example D: Proactive replenishment for zero-demand items", () => {
  // Current Stock = 5, Demand = 0, Safety Stock = 20 -> Generates Net Requirement = 15
  const netReqs = [];
  const inventory = [{ itemId: 104, availableQuantity: 5 }];
  const items = [{ itemId: 104, itemCode: "ITEM-D", safetyStock: 20 }];

  const results = applySafetyStockPolicy(netReqs, inventory, items);

  assert.equal(results.length, 1);
  assert.equal(results[0].itemId, 104);
  assert.equal(results[0].grossRequirement, 0);
  assert.equal(results[0].demandRequirement, 0);
  assert.equal(results[0].safetyStockDeficit, 15);
  assert.equal(results[0].netRequirement, 15);
});
