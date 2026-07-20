const { ValidationError } = require("../errors/mrp.errors");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").Item} Item */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */

/**
 * Validates item master records.
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

    if (typeof item.itemType !== "string" || item.itemType.trim() === "") {
      throw new ValidationError(`Item ${item.itemId} is missing a valid itemType.`);
    }

    if (typeof item.baseUom !== "string" || item.baseUom.trim() === "") {
      throw new ValidationError(`Item ${item.itemId} is missing a valid baseUom.`);
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

    if (typeof line.quantity !== "number" || isNaN(line.quantity) || line.quantity <= 0) {
      throw new ValidationError(`Demand line ${line.demandId || i} has an invalid quantity (${line.quantity}). Quantity must be greater than zero.`);
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

  const bomParentItemIds = new Set(bom.headers.map((h) => h.parentItemId));
  const validItemIds = new Set(items.map((it) => it.itemId));

  for (const line of demandLines) {
    if (!bomParentItemIds.has(line.itemId)) {
      throw new ValidationError(`Demanded item ${line.itemId} does not have a Bill of Materials (BOM).`);
    }
  }

  for (let i = 0; i < bom.lines.length; i++) {
    const bomLine = bom.lines[i];

    if (typeof bomLine.qtyPerParent !== "number" || isNaN(bomLine.qtyPerParent) || bomLine.qtyPerParent <= 0) {
      throw new ValidationError(`BOM line ${bomLine.bomLineId || i} must have a qtyPerParent greater than zero.`);
    }

    if (!validItemIds.has(bomLine.childItemId)) {
      throw new ValidationError(`BOM child item ${bomLine.childItemId} does not exist in Item Master.`);
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
