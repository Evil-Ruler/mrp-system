const { ValidationError } = require("../errors/mrp.errors");
const { VALID_PROCUREMENT_TYPES } = require("../constants/procurement.constants");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */

/**
 * Validates item master records.
 *
 * Enforces Planning DTO invariants:
 * - itemId: required
 * - itemCode: required non-empty string
 * - baseUom: required non-empty string
 * - procurementType: required and must be present in VALID_PROCUREMENT_TYPES ("PURCHASE" or "PRODUCTION")
 *
 * @param {Item[]} items
 * @throws {ValidationError}
 */
function validateItems(items) {
  if (!Array.isArray(items)) {
    throw new ValidationError("Items data must be an array.");
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Item at index ${i} must be a valid object.`);
    }

    if (item.itemId === undefined || item.itemId === null) {
      throw new ValidationError(`Item at index ${i} is missing itemId.`);
    }

    if (typeof item.itemCode !== "string" || item.itemCode.trim() === "") {
      throw new ValidationError(`Item ${item.itemId} is missing a valid itemCode.`);
    }

    if (typeof item.baseUom !== "string" || item.baseUom.trim() === "") {
      throw new ValidationError(`Item ${item.itemId} is missing a valid baseUom.`);
    }

    if (
      item.procurementType === undefined ||
      item.procurementType === null ||
      typeof item.procurementType !== "string" ||
      item.procurementType.trim() === ""
    ) {
      throw new ValidationError(`Item ${item.itemId} is missing a valid procurementType.`);
    }

    if (!VALID_PROCUREMENT_TYPES.has(item.procurementType)) {
      throw new ValidationError(
        `Item ${item.itemId} has invalid procurementType "${item.procurementType}". Must be "PURCHASE" or "PRODUCTION".`
      );
    }
  }
}

/**
 * Validates sales order demand lines.
 *
 * @param {Demand[]} demandLines
 * @throws {ValidationError}
 */
function validateDemand(demandLines) {
  if (!Array.isArray(demandLines)) {
    throw new ValidationError("Demand data must be an array.");
  }

  for (let i = 0; i < demandLines.length; i++) {
    const line = demandLines[i];
    if (!line || typeof line !== "object") {
      throw new ValidationError(`Demand line at index ${i} must be a valid object.`);
    }

    if (line.itemId === undefined || line.itemId === null) {
      throw new ValidationError(`Demand line at index ${i} is missing itemId.`);
    }

    if (!line.requiredDate || isNaN(new Date(line.requiredDate).getTime())) {
      throw new ValidationError(`Demand line ${line.demandId || i} is missing a valid requiredDate.`);
    }

    if (typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new ValidationError(`Demand line ${line.demandId || i} has an invalid quantity (${line.quantity}). Quantity must be greater than zero.`);
    }

    if (line.salesOrderId === undefined || line.salesOrderId === null || String(line.salesOrderId).trim() === "") {
      throw new ValidationError(`Demand line ${line.demandId || i} is missing a salesOrderId.`);
    }

    if (line.salesOrderLineId === undefined || line.salesOrderLineId === null) {
      throw new ValidationError(`Demand line ${line.demandId || i} is missing a salesOrderLineId.`);
    }
  }
}

/**
 * Validates BOM structure against demand lines and item master.
 *
 * @param {{headers: BomHeader[], lines: BomLine[]}} bom
 * @param {Demand[]} demandLines
 * @param {Item[]} items
 * @throws {ValidationError}
 */
function validateBom(bom, demandLines, items) {
  if (!bom || typeof bom !== "object" || !Array.isArray(bom.headers) || !Array.isArray(bom.lines)) {
    throw new ValidationError("BOM data must contain headers and lines arrays.");
  }

  const validItemIds = new Set(items.map((it) => it.itemId));
  const itemCodeMap = new Map(items.map((it) => [it.itemId, it.itemCode]));

  // 1. Group BOMHeader records by parentItemId / finishedGoodId
  const headersByParent = new Map();
  const headerIdSet = new Set();

  for (let i = 0; i < bom.headers.length; i++) {
    const header = bom.headers[i];
    const parentId = header.parentItemId;

    if (!validItemIds.has(parentId)) {
      throw new ValidationError(
        `BOM header ${header.bomHeaderId || i} references parent item ${parentId} which does not exist in Item Master.`
      );
    }

    if (header.bomHeaderId) {
      headerIdSet.add(header.bomHeaderId);
    }

    if (!headersByParent.has(parentId)) {
      headersByParent.set(parentId, []);
    }
    headersByParent.get(parentId).push(header);
  }

  // Check for multiple BOM headers per finished good / parent item
  for (const [parentId, headerList] of headersByParent.entries()) {
    if (headerList.length > 1) {
      const codeStr = itemCodeMap.get(parentId) || `FG-${parentId}`;
      throw new ValidationError(
        `Multiple BOMs found for Finished Good ${codeStr}. Phase 2 supports exactly one BOM per finished good.`
      );
    }
  }

  // 2. Validate BOM lines (orphan BOM lines, missing child items, and Number.isFinite for qtyPerParent)
  const linesByHeader = new Map();

  for (let i = 0; i < bom.lines.length; i++) {
    const bomLine = bom.lines[i];

    if (typeof bomLine.qtyPerParent !== "number" || !Number.isFinite(bomLine.qtyPerParent) || bomLine.qtyPerParent <= 0) {
      throw new ValidationError(`BOM line ${bomLine.bomLineId || i} must have a qtyPerParent greater than zero.`);
    }

    if (!validItemIds.has(bomLine.childItemId)) {
      throw new ValidationError(`BOM child item ${bomLine.childItemId} does not exist in Item Master.`);
    }

    if (!headerIdSet.has(bomLine.bomHeaderId)) {
      throw new ValidationError(
        `Orphan BOM line ${bomLine.bomLineId || i} references non-existent BOM header ${bomLine.bomHeaderId}.`
      );
    }

    if (!linesByHeader.has(bomLine.bomHeaderId)) {
      linesByHeader.set(bomLine.bomHeaderId, []);
    }
    linesByHeader.get(bomLine.bomHeaderId).push(bomLine);
  }

  // 3. Validate only directly demanded finished goods. Recursive BOM graph
  // traversal, including validation of reachable sub-assemblies and cycle
  // detection, belongs exclusively to bomExplosion.js.
  for (const demandLine of demandLines) {
    const headers = headersByParent.get(demandLine.itemId);
    if (!headers || headers.length === 0) {
      throw new ValidationError(`Demanded item ${demandLine.itemId} does not have a Bill of Materials (BOM).`);
    }

    const header = headers[0];
    const childLines = linesByHeader.get(header.bomHeaderId) || [];
    if (childLines.length === 0) {
      const codeStr = itemCodeMap.get(demandLine.itemId) || `FG-${demandLine.itemId}`;
      throw new ValidationError(
        `Finished Good ${codeStr} is required for planning but its BOM contains no components.`
      );
    }
  }
}

/**
 * Sorts demand lines by required date, sales order ID, and sales order line ID.
 *
 * @param {Demand[]} demandLines
 * @returns {Demand[]}
 */
function sortDemand(demandLines) {
  if (!Array.isArray(demandLines)) {
    return [];
  }

  return [...demandLines].sort((a, b) => {
    const timeA = new Date(a.requiredDate).getTime();
    const timeB = new Date(b.requiredDate).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    const orderCompare = String(a.salesOrderId || "").localeCompare(String(b.salesOrderId || ""));
    if (orderCompare !== 0) {
      return orderCompare;
    }

    const lineA = Number(a.salesOrderLineId);
    const lineB = Number(b.salesOrderLineId);
    if (!isNaN(lineA) && !isNaN(lineB) && lineA !== lineB) {
      return lineA - lineB;
    }

    return String(a.salesOrderLineId || "").localeCompare(String(b.salesOrderLineId || ""));
  });
}

module.exports = {
  validateItems,
  validateDemand,
  validateBom,
  sortDemand,
};
