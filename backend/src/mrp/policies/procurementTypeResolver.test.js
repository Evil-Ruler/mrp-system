const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveProcurementTypeFromCategory } = require("./procurementTypeResolver");
const { PROCUREMENT_TYPES } = require("../constants/procurement.constants");

test("resolveProcurementTypeFromCategory - maps finished goods to PRODUCTION", () => {
  assert.equal(resolveProcurementTypeFromCategory("FINISHED_GOOD"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("Finished Good"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("FINISHED_GOODS"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("FG"), PROCUREMENT_TYPES.PRODUCTION);
});

test("resolveProcurementTypeFromCategory - maps produced sub-assemblies to PRODUCTION", () => {
  assert.equal(resolveProcurementTypeFromCategory("PRODUCED_SUB_ASSEMBLY"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("PRODUCED_SUBASSEMBLY"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("SUB_ASSEMBLY"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("Sub Assembly"), PROCUREMENT_TYPES.PRODUCTION);
  assert.equal(resolveProcurementTypeFromCategory("SA"), PROCUREMENT_TYPES.PRODUCTION);
});

test("resolveProcurementTypeFromCategory - maps purchased sub-assemblies to PURCHASE", () => {
  assert.equal(resolveProcurementTypeFromCategory("PURCHASED_SUB_ASSEMBLY"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("PURCHASED_SUBASSEMBLY"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("Purchased Sub-Assembly"), PROCUREMENT_TYPES.PURCHASE);
});

test("resolveProcurementTypeFromCategory - maps raw materials to PURCHASE", () => {
  assert.equal(resolveProcurementTypeFromCategory("RAW_MATERIAL"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("Raw Material"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("RAW_MATERIALS"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("RM"), PROCUREMENT_TYPES.PURCHASE);
});

test("resolveProcurementTypeFromCategory - maps consumables to PURCHASE", () => {
  assert.equal(resolveProcurementTypeFromCategory("CONSUMABLE"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("Consumable"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("CONSUMABLES"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("CN"), PROCUREMENT_TYPES.PURCHASE);
});

test("resolveProcurementTypeFromCategory - maps hardware to PURCHASE", () => {
  assert.equal(resolveProcurementTypeFromCategory("HARDWARE"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("Hardware"), PROCUREMENT_TYPES.PURCHASE);
  assert.equal(resolveProcurementTypeFromCategory("HW"), PROCUREMENT_TYPES.PURCHASE);
});

test("resolveProcurementTypeFromCategory - returns null for unsupported or unknown category", () => {
  assert.equal(resolveProcurementTypeFromCategory("UNKNOWN_CATEGORY"), null);
  assert.equal(resolveProcurementTypeFromCategory("SERVICES"), null);
  assert.equal(resolveProcurementTypeFromCategory("SOFTWARE"), null);
});

test("resolveProcurementTypeFromCategory - returns null for missing or empty input", () => {
  assert.equal(resolveProcurementTypeFromCategory(null), null);
  assert.equal(resolveProcurementTypeFromCategory(undefined), null);
  assert.equal(resolveProcurementTypeFromCategory(""), null);
  assert.equal(resolveProcurementTypeFromCategory("   "), null);
});
