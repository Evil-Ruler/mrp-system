const { ValidationError } = require("../errors/mrp.errors");

/** @typedef {import("../types/mrp.types").Demand} Demand */
/** @typedef {import("../types/mrp.types").BomHeader} BomHeader */
/** @typedef {import("../types/mrp.types").BomLine} BomLine */
/** @typedef {import("../types/mrp.types").Item} Item */

/**
 * @typedef {Object} ExplodedRequirement
 * @property {"SALES_ORDER"} demandSourceType
 * @property {string} salesOrderId
 * @property {number} salesOrderLineId
 * @property {number} itemId
 * @property {number} requiredQuantity
 * @property {Date} requiredDate
 * @property {number} bomLevel
 * @property {number[]} path
 */

/**
 * @typedef {Object} TraversalContext
 * @property {Demand} demandLine
 * @property {number} currentItemId
 * @property {number} currentQuantity
 * @property {number} bomLevel
 * @property {number[]} path
 * @property {Set<number>} visitedSet
 * @property {Map<number, BomLine[]>} bomLookup
 * @property {ExplodedRequirement[]} results
 */

/**
 * Builds a pre-indexed BOM lookup map for O(1) child retrieval via BOMHeader -> BOMLines.
 *
 * @param {{headers?: BomHeader[], lines?: BomLine[]}|BomLine[]} [bom]
 * @returns {Map<number, BomLine[]>}
 */
function createBomLookup(bom) {
  const bomMap = new Map();
  if (!bom || typeof bom !== "object") {
    return bomMap;
  }

  const headers = Array.isArray(bom.headers) ? bom.headers : [];
  const lines = Array.isArray(bom.lines) ? bom.lines : (Array.isArray(bom) ? bom : []);

  const parentToHeaderMap = new Map();
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h && h.parentItemId !== undefined && h.bomHeaderId) {
      parentToHeaderMap.set(h.parentItemId, h.bomHeaderId);
    }
  }

  const headerToLinesMap = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const headerId = line.bomHeaderId || parentToHeaderMap.get(line.parentItemId);
    if (headerId) {
      if (!headerToLinesMap.has(headerId)) {
        headerToLinesMap.set(headerId, []);
      }
      headerToLinesMap.get(headerId).push(line);
    } else if (line.parentItemId !== undefined) {
      if (!bomMap.has(line.parentItemId)) {
        bomMap.set(line.parentItemId, []);
      }
      bomMap.get(line.parentItemId).push(line);
    }
  }

  for (const [parentId, headerId] of parentToHeaderMap.entries()) {
    const childLines = headerToLinesMap.get(headerId) || [];
    bomMap.set(parentId, childLines);
  }

  return bomMap;
}

/**
 * Factory for creating immutable ExplodedRequirement records.
 *
 * @param {TraversalContext} context
 * @param {number} childItemId
 * @param {number} requiredQuantity
 * @param {number[]} childPath
 * @returns {ExplodedRequirement}
 */
function createRequirement(context, childItemId, requiredQuantity, childPath) {
  return {
    demandSourceType: "SALES_ORDER",
    salesOrderId: context.demandLine.salesOrderId,
    salesOrderLineId: context.demandLine.salesOrderLineId,
    itemId: childItemId,
    requiredQuantity,
    requiredDate: context.demandLine.requiredDate,
    bomLevel: context.bomLevel,
    path: childPath,
  };
}

/**
 * Standalone recursive graph traversal for exploding BOM sub-assemblies.
 *
 * @param {TraversalContext} context
 * @throws {ValidationError} If a cyclic dependency is detected or qtyPerParent is invalid
 */
function traverseBom(context) {
  const { currentItemId, currentQuantity, bomLevel, path, visitedSet, bomLookup, results } = context;

  const childLines = bomLookup.get(currentItemId);
  if (!childLines || childLines.length === 0) {
    return;
  }

  for (let i = 0; i < childLines.length; i++) {
    const childLine = childLines[i];
    const childItemId = childLine.childItemId;

    // Fast O(1) cycle detection
    if (visitedSet.has(childItemId)) {
      throw new ValidationError(
        `Cyclic BOM dependency detected for item ${childItemId}.`
      );
    }

    // Defensive check for quantity multiplier
    if (
      typeof childLine.qtyPerParent !== "number" ||
      isNaN(childLine.qtyPerParent) ||
      childLine.qtyPerParent <= 0
    ) {
      throw new ValidationError(
        `BOM line ${childLine.bomLineId || i} must have a qtyPerParent greater than zero.`
      );
    }

    const requiredQuantity = currentQuantity * childLine.qtyPerParent;
    const childPath = [...path, childItemId];

    results.push(createRequirement(context, childItemId, requiredQuantity, childPath));

    // Continue recursive explosion when component is itself an assembly
    visitedSet.add(childItemId);
    traverseBom({
      ...context,
      currentItemId: childItemId,
      currentQuantity: requiredQuantity,
      bomLevel: bomLevel + 1,
      path: childPath,
    });
    visitedSet.delete(childItemId);
  }
}

/**
 * 5-Key compound comparator for sorting exploded requirements deterministically.
 *
 * @param {ExplodedRequirement} a
 * @param {ExplodedRequirement} b
 * @returns {number}
 */
function compareRequirements(a, b) {
  // 1. requiredDate ascending (direct Date timestamp check without re-allocation)
  const timeA = a.requiredDate.getTime();
  const timeB = b.requiredDate.getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // 2. bomLevel ascending
  if (a.bomLevel !== b.bomLevel) {
    return a.bomLevel - b.bomLevel;
  }

  // 3. itemId ascending
  if (a.itemId !== b.itemId) {
    return a.itemId - b.itemId;
  }

  // 4. salesOrderId ascending
  const orderCompare = a.salesOrderId.localeCompare(b.salesOrderId);
  if (orderCompare !== 0) {
    return orderCompare;
  }

  // 5. salesOrderLineId ascending
  const lineA = Number(a.salesOrderLineId);
  const lineB = Number(b.salesOrderLineId);
  if (!isNaN(lineA) && !isNaN(lineB) && lineA !== lineB) {
    return lineA - lineB;
  }

  return String(a.salesOrderLineId).localeCompare(String(b.salesOrderLineId));
}

/**
 * Explodes finished good demand into component requirements across arbitrary BOM depth levels.
 *
 * **Business Guarantees**:
 * - Root finished goods are never emitted in the output collection.
 * - Output contains unaggregated, time-phased component requirements preserving sales order lineage.
 * - Input `planningData` is never mutated.
 * - Returned collection is a newly allocated array.
 * - Returned array is deterministically sorted by `requiredDate` (asc), `bomLevel` (asc), `itemId` (asc), `salesOrderId` (asc), and `salesOrderLineId` (asc).
 *
 * @param {{demand: Demand[], bom: {headers: BomHeader[], lines: BomLine[]}, items: Item[]}} planningData
 * @returns {ExplodedRequirement[]} Deterministically sorted array of exploded component requirements
 * @throws {ValidationError} If a cyclic BOM dependency is detected or qtyPerParent is invalid
 */
function explodeBom(planningData) {
  if (
    !planningData ||
    !Array.isArray(planningData.demand) ||
    planningData.demand.length === 0
  ) {
    return [];
  }

  const bomLookup = createBomLookup(planningData.bom);
  const results = [];

  for (let i = 0; i < planningData.demand.length; i++) {
    const demandLine = planningData.demand[i];
    const rootItemId = demandLine.itemId;

    const path = [rootItemId];
    const visitedSet = new Set([rootItemId]);

    traverseBom({
      demandLine,
      currentItemId: rootItemId,
      currentQuantity: demandLine.quantity,
      bomLevel: 1,
      path,
      visitedSet,
      bomLookup,
      results,
    });
  }

  results.sort(compareRequirements);

  return results;
}

module.exports = {
  explodeBom,
};
