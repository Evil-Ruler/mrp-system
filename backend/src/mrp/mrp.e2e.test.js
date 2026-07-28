const test = require("node:test");
const assert = require("node:assert/strict");

const repository = require("./repositories/mrp.repository");
const mrpService = require("./services/mrp.service");
const { ValidationError, DataAccessError } = require("./errors/mrp.errors");

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
// TEST 1: COMPLETE HAPPY PATH MANUFACTURING WORKFLOW
// ============================================================================

test("E2E - Complete happy path manufacturing workflow through all 6 pipeline stages", async () => {
  repository.getDemandOrderLines = async () => [
    {
      demandId: "SO-100:1",
      salesOrderId: "SO-100",
      salesOrderLineId: 1,
      itemId: 1000, // FG
      quantity: 10,
      requiredDate: new Date("2026-08-10T00:00:00.000Z"),
      uom: "PCS",
    },
  ];

  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 2000, itemCode: "SA-2000", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3000, itemCode: "RM-3000", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];

  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-1000", parentItemId: 1000 },
      { bomHeaderId: "BOM-2000", parentItemId: 2000 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-1000", parentItemId: 1000, childItemId: 2000, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-2000", parentItemId: 2000, childItemId: 3000, qtyPerParent: 5 },
    ],
  });

  // Stock: 5 SA, 20 RM
  repository.getInventory = async () => [
    { itemId: 2000, availableQuantity: 5 },
    { itemId: 3000, availableQuantity: 20 },
  ];

  // PO: 10 RM
  repository.getOpenPurchaseOrders = async () => [
    { purchaseOrderId: "PO-10", itemId: 3000, openQuantity: 10, expectedDate: new Date("2026-08-05") },
  ];

  // MO: 5 SA
  repository.getOpenProductionOrders = async () => [
    { productionOrderId: "MO-10", itemId: 2000, openQuantity: 5, expectedDate: new Date("2026-08-05") },
  ];

  const result = await mrpService.runPlanning();

  // 1. Contract Validation
  assert.ok(result.planningDate instanceof Date);
  assert.equal(result.salesOrders.length, 1);

  // 2. Planned-order traversal includes the FG, then only components required
  // by surviving production recommendations.
  assert.equal(result.explodedRequirements.length, 3);

  // 3. Stage 2: FG is planned first; the 5 open SA units suppress half of the
  // sub-assembly production, so only 50 RM are required downstream.
  assert.equal(result.netRequirements.length, 3);
  const saNet = result.netRequirements.find((r) => r.itemId === 2000);
  const rmNet = result.netRequirements.find((r) => r.itemId === 3000);
  assert.equal(saNet.netRequirement, 15);
  assert.equal(rmNet.netRequirement, 30);

  // 4. Stage 3: Allocation is applied to each recursively planned requirement.
  assert.equal(result.allocatedRequirements.length, 3);
  const saAlloc = result.allocatedRequirements.find((r) => r.itemId === 2000);
  const rmAlloc = result.allocatedRequirements.find((r) => r.itemId === 3000);
  assert.equal(saAlloc.remainingShortage, 10);
  assert.equal(rmAlloc.remainingShortage, 20);

  // 5. Stage 4: Recommendations
  assert.equal(result.recommendations.length, 3);
  const fgRec = result.recommendations.find((r) => r.itemId === 1000);
  const saRec = result.recommendations.find((r) => r.itemId === 2000);
  const rmRec = result.recommendations.find((r) => r.itemId === 3000);
  assert.equal(fgRec.recommendationType, "PRODUCTION");
  assert.equal(fgRec.quantity, 10);
  assert.equal(saRec.recommendationType, "PRODUCTION");
  assert.equal(saRec.quantity, 10);
  assert.equal(rmRec.recommendationType, "PURCHASE");
  assert.equal(rmRec.quantity, 20);

  // 6. Summary Validation
  assert.deepEqual(result.summary, {
    salesOrderCount: 1,
    explodedRequirementCount: 3,
    netRequirementCount: 3,
    allocatedRequirementCount: 3,
    recommendationCount: 3,
    purchaseRecommendationCount: 1,
    productionRecommendationCount: 2,
    totalShortageQuantity: 40,
  });
});

// ============================================================================
// TEST 2: MULTIPLE SALES ORDERS WITH SHARED COMPONENTS
// ============================================================================

test("E2E - Multiple sales orders preserve distinct unaggregated lineage", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 5, requiredDate: new Date("2026-08-10"), uom: "PCS" },
    { demandId: "SO-2:1", salesOrderId: "SO-2", salesOrderLineId: 1, itemId: 100, quantity: 10, requiredDate: new Date("2026-08-15"), uom: "PCS" },
  ];

  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];

  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 2 }],
  });

  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.recommendations.length, 4);

  const so1 = result.recommendations.filter((r) => r.salesOrderId === "SO-1");
  const so2 = result.recommendations.filter((r) => r.salesOrderId === "SO-2");
  assert.deepEqual(so1.map((r) => r.quantity), [5, 10]);
  assert.deepEqual(so2.map((r) => r.quantity), [10, 20]);
});

// ============================================================================
// TEST 3: SHARED COMPONENT DEMAND ACROSS DIFFERENT FINISHED GOODS
// ============================================================================

test("E2E - Shared component demand across different finished goods", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 101, quantity: 2, requiredDate: new Date("2026-08-10"), uom: "PCS" },
    { demandId: "SO-1:2", salesOrderId: "SO-1", salesOrderLineId: 2, itemId: 102, quantity: 3, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];

  repository.getItems = async () => [
    { itemId: 101, itemCode: "FG-101", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 102, itemCode: "FG-102", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 999, itemCode: "RM-COMMON", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];

  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-101", parentItemId: 101 },
      { bomHeaderId: "BOM-102", parentItemId: 102 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-101", parentItemId: 101, childItemId: 999, qtyPerParent: 10 },
      { bomLineId: 2, bomHeaderId: "BOM-102", parentItemId: 102, childItemId: 999, qtyPerParent: 5 },
    ],
  });

  // Stock: 15 RM-COMMON (covers FG-101's 20 requirement partially -> 5 left; leaves FG-102's 15 untouched)
  repository.getInventory = async () => [{ itemId: 999, availableQuantity: 15 }];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.recommendations.length, 4);
  assert.deepEqual(result.recommendations.map((r) => r.quantity), [2, 5, 3, 15]);
});

// ============================================================================
// TEST 4: MULTI-LEVEL BOM ANCESTRY TRAVERSAL (FG -> SA1 -> SA2 -> RM)
// ============================================================================

test("E2E - 4-level deep BOM hierarchy preserves bomLevel and path ancestry", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 1, quantity: 1, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];

  repository.getItems = async () => [
    { itemId: 1, itemCode: "FG-1", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 2, itemCode: "SA-1", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3, itemCode: "SA-2", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 4, itemCode: "RM-1", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];

  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-1", parentItemId: 1 },
      { bomHeaderId: "BOM-2", parentItemId: 2 },
      { bomHeaderId: "BOM-3", parentItemId: 3 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-1", parentItemId: 1, childItemId: 2, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-2", parentItemId: 2, childItemId: 3, qtyPerParent: 3 },
      { bomLineId: 3, bomHeaderId: "BOM-3", parentItemId: 3, childItemId: 4, qtyPerParent: 4 },
    ],
  });

  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.explodedRequirements.length, 4);
  const rmReq = result.explodedRequirements.find((r) => r.itemId === 4);
  assert.equal(rmReq.requiredQuantity, 24); // 1 * 2 * 3 * 4
  assert.equal(rmReq.bomLevel, 3);
  assert.deepEqual(rmReq.path, [1, 2, 3, 4]);
});

// ============================================================================
// TEST 5: FULL INVENTORY COVERAGE (ZERO SHORTAGES)
// ============================================================================

test("E2E - Full inventory coverage suppresses all recommendations", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 2 }],
  });

  repository.getInventory = async () => [{ itemId: 100, availableQuantity: 100 }];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.summary.totalShortageQuantity, 0);
});

// ============================================================================
// TEST 6 & 7: OPEN PURCHASE AND PRODUCTION ORDER COVERAGE
// ============================================================================

test("E2E - Open purchase and production orders eliminate remaining shortages", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "SA-200", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 300, itemCode: "RM-300", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-100", parentItemId: 100 },
      { bomHeaderId: "BOM-200", parentItemId: 200 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-200", parentItemId: 200, childItemId: 300, qtyPerParent: 5 },
    ],
  });

  repository.getInventory = async () => [];
  repository.getOpenProductionOrders = async () => [{ productionOrderId: "MO-1", itemId: 100, openQuantity: 10, expectedDate: new Date("2026-08-01") }];
  repository.getOpenPurchaseOrders = async () => [{ purchaseOrderId: "PO-1", itemId: 300, openQuantity: 100, expectedDate: new Date("2026-08-01") }];

  const result = await mrpService.runPlanning();

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.summary.totalShortageQuantity, 0);
});

// ============================================================================
// TEST 8: MIXED SUPPLY SOURCES AND ALLOCATION PRIORITY
// ============================================================================

test("E2E - Mixed supply sources enforce strict priority (Inventory -> PO -> MO -> Shortage)", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 10 }], // Gross = 100
  });

  // Supply: Inv = 30, PO = 40, MO = 20 -> Total Supply = 90 -> Shortage = 10
  repository.getInventory = async () => [{ itemId: 200, availableQuantity: 30 }];
  repository.getOpenPurchaseOrders = async () => [{ purchaseOrderId: "PO-1", itemId: 200, openQuantity: 40, expectedDate: new Date("2026-08-01") }];
  repository.getOpenProductionOrders = async () => [{ productionOrderId: "MO-1", itemId: 200, openQuantity: 20, expectedDate: new Date("2026-08-01") }];

  const result = await mrpService.runPlanning();

  const alloc = result.allocatedRequirements.find((entry) => entry.itemId === 200);
  assert.equal(alloc.grossRequirement, 100);
  assert.equal(alloc.availableInventoryUsed, 30);
  assert.equal(alloc.purchaseSupplyUsed, 40);
  assert.equal(alloc.productionSupplyUsed, 20);
  assert.equal(alloc.remainingShortage, 10);

  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations.find((r) => r.itemId === 200).quantity, 10);
});

// ============================================================================
// TEST 9 & 10: NO SUPPLY & INVALID MASTER DATA
// ============================================================================

test("E2E - No supply available generates 100% shortage recommendations", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 5 }],
  });

  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations.find((r) => r.itemId === 100).quantity, 10);
  assert.equal(result.recommendations.find((r) => r.itemId === 200).quantity, 50);
  assert.equal(result.summary.totalShortageQuantity, 60);
});

test("E2E - Stops planning immediately when demanded item has no BOM", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 999, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [{ itemId: 999, itemCode: "FG-NO-BOM", itemType: "FINISHED_GOOD", baseUom: "PCS" }];
  repository.getBomData = async () => ({ headers: [], lines: [] });
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  await assert.rejects(
    () => mrpService.runPlanning(),
    (err) => err instanceof ValidationError
  );
});

// ============================================================================
// TEST 11 & 12: REPOSITORY FAILURE & EMPTY DEMAND
// ============================================================================

test("E2E - Propagates repository DataAccessError unchanged", async () => {
  const dbFailure = new DataAccessError("Prisma connection failure");
  repository.getDemandOrderLines = async () => { throw dbFailure; };

  await assert.rejects(
    () => mrpService.runPlanning(),
    (err) => err === dbFailure
  );
});

test("E2E - Short-circuits when demand is empty", async () => {
  repository.getDemandOrderLines = async () => [];

  const result = await mrpService.runPlanning();

  assert.equal(result.salesOrders.length, 0);
  assert.equal(result.explodedRequirements.length, 0);
  assert.equal(result.recommendations.length, 0);
  assert.equal(result.summary.recommendationCount, 0);
});

// ============================================================================
// TEST 13 & 14: LINEAGE PRESERVATION & SUMMARY RECONCILIATION
// ============================================================================

test("E2E - Preserves complete demand lineage and reconciles summary metrics", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-888:5", salesOrderId: "SO-888", salesOrderLineId: 5, itemId: 100, quantity: 2, requiredDate: new Date("2026-09-01"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 10 }],
  });

  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const result = await mrpService.runPlanning();

  const rec = result.recommendations.find((r) => r.itemId === 200);
  assert.equal(rec.salesOrderId, "SO-888");
  assert.equal(rec.salesOrderLineId, 5);
  assert.equal(rec.requiredDate.toISOString(), new Date("2026-09-01").toISOString());
  assert.equal(rec.bomLevel, 1);
  assert.deepEqual(rec.path, [100, 200]);

  // Reconciliation Check
  assert.equal(result.summary.recommendationCount, result.recommendations.length);
  assert.equal(result.summary.totalShortageQuantity, 22);
});

// ============================================================================
// TEST 15 & 16: DETERMINISM & IMMUTABILITY
// ============================================================================

test("E2E - Planning execution is strictly deterministic and never mutates repository data", async () => {
  const mockDemand = [{ demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 100, quantity: 2, requiredDate: new Date("2026-08-10"), uom: "PCS" }];
  const mockItems = [
    { itemId: 100, itemCode: "FG-100", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 200, itemCode: "RM-200", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  const mockBom = {
    headers: [{ bomHeaderId: "BOM-100", parentItemId: 100 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-100", parentItemId: 100, childItemId: 200, qtyPerParent: 5 }],
  };

  const demandBaseline = structuredClone(mockDemand);
  const itemsBaseline = structuredClone(mockItems);

  repository.getDemandOrderLines = async () => mockDemand;
  repository.getItems = async () => mockItems;
  repository.getBomData = async () => mockBom;
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const res1 = await mrpService.runPlanning();
  const res2 = await mrpService.runPlanning();

  // Determinism Assertion
  assert.deepEqual(res1.salesOrders, res2.salesOrders);
  assert.deepEqual(res1.explodedRequirements, res2.explodedRequirements);
  assert.deepEqual(res1.recommendations, res2.recommendations);

  // Immutability Assertion
  assert.deepEqual(mockDemand, demandBaseline);
  assert.deepEqual(mockItems, itemsBaseline);
});

// ============================================================================
// TEST 17 & 18: CONTRACT VALIDATION & HIGH VOLUME STRESS VERIFICATION
// ============================================================================

test("E2E - PlanningResult contains exact 7 domain contract keys", async () => {
  repository.getDemandOrderLines = async () => [];
  const result = await mrpService.runPlanning();

  const keys = Object.keys(result).sort();
  assert.deepEqual(keys, [
    "allocatedRequirements",
    "explodedRequirements",
    "netRequirements",
    "planningDate",
    "recommendations",
    "salesOrders",
    "summary",
  ]);
});

test("E2E - High volume performance stress verification (100 demands, multi-level BOM)", async () => {
  const demandList = [];
  for (let i = 1; i <= 100; i++) {
    demandList.push({
      demandId: `SO-${i}:1`,
      salesOrderId: `SO-${i}`,
      salesOrderLineId: 1,
      itemId: 1000,
      quantity: 5,
      requiredDate: new Date(`2026-08-${(i % 28) + 1}`),
      uom: "PCS",
    });
  }

  repository.getDemandOrderLines = async () => demandList;
  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 2000, itemCode: "SA-2000", itemType: "SUB_ASSEMBLY", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3000, itemCode: "RM-3000", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-1000", parentItemId: 1000 },
      { bomHeaderId: "BOM-2000", parentItemId: 2000 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-1000", parentItemId: 1000, childItemId: 2000, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-2000", parentItemId: 2000, childItemId: 3000, qtyPerParent: 5 },
    ],
  });

  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const start = Date.now();
  const result = await mrpService.runPlanning();
  const duration = Date.now() - start;

  assert.equal(result.explodedRequirements.length, 300);
  assert.equal(result.recommendations.length, 300);
  assert.ok(duration < 200, `Expected runPlanning to complete in < 200ms, took ${duration}ms`);
});

// ============================================================================
// TEST 19, 20, 21: AMBIGUOUS BOMS, EMPTY BOMS, MULTI-RUN STABILITY
// ============================================================================

test("E2E - Rejects planning run with ValidationError when multiple BOM headers exist for same finished good", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 1000, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3000, itemCode: "RM-3000", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [
      { bomHeaderId: "BOM-1000-A", parentItemId: 1000 },
      { bomHeaderId: "BOM-1000-B", parentItemId: 1000 },
    ],
    lines: [
      { bomLineId: 1, bomHeaderId: "BOM-1000-A", parentItemId: 1000, childItemId: 3000, qtyPerParent: 2 },
      { bomLineId: 2, bomHeaderId: "BOM-1000-B", parentItemId: 1000, childItemId: 3000, qtyPerParent: 3 },
    ],
  });
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  await assert.rejects(
    () => mrpService.runPlanning(),
    (err) => err instanceof ValidationError && err.message.includes("Multiple BOMs found for Finished Good FG-1000")
  );
});

test("E2E - Rejects planning run when active demanded finished good has an empty BOM", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 1000, quantity: 10, requiredDate: new Date("2026-08-10"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-1000", parentItemId: 1000 }],
    lines: [],
  });
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  await assert.rejects(
    () => mrpService.runPlanning(),
    (err) => err instanceof ValidationError && err.message.includes("Finished Good FG-1000 is required for planning but its BOM contains no components")
  );
});

test("E2E - Produces strictly stable planning output across 10 repeated executions", async () => {
  repository.getDemandOrderLines = async () => [
    { demandId: "SO-1:1", salesOrderId: "SO-1", salesOrderLineId: 1, itemId: 1000, quantity: 5, requiredDate: new Date("2026-08-10"), uom: "PCS" },
    { demandId: "SO-2:1", salesOrderId: "SO-2", salesOrderLineId: 1, itemId: 1000, quantity: 10, requiredDate: new Date("2026-08-12"), uom: "PCS" },
  ];
  repository.getItems = async () => [
    { itemId: 1000, itemCode: "FG-1000", itemType: "FINISHED_GOOD", procurementType: "PRODUCTION", baseUom: "PCS" },
    { itemId: 3000, itemCode: "RM-3000", itemType: "RAW_MATERIAL", procurementType: "PURCHASE", baseUom: "KG" },
  ];
  repository.getBomData = async () => ({
    headers: [{ bomHeaderId: "BOM-1000", parentItemId: 1000 }],
    lines: [{ bomLineId: 1, bomHeaderId: "BOM-1000", parentItemId: 1000, childItemId: 3000, qtyPerParent: 2 }],
  });
  repository.getInventory = async () => [];
  repository.getOpenPurchaseOrders = async () => [];
  repository.getOpenProductionOrders = async () => [];

  const firstRun = await mrpService.runPlanning();

  for (let run = 0; run < 10; run++) {
    const nextRun = await mrpService.runPlanning();
    assert.deepEqual(nextRun.salesOrders, firstRun.salesOrders);
    assert.deepEqual(nextRun.explodedRequirements, firstRun.explodedRequirements);
    assert.deepEqual(nextRun.netRequirements, firstRun.netRequirements);
    assert.deepEqual(nextRun.allocatedRequirements, firstRun.allocatedRequirements);
    assert.deepEqual(nextRun.recommendations, firstRun.recommendations);
    assert.deepEqual(nextRun.summary, firstRun.summary);
  }
});
