const { ValidationError } = require("../errors/mrp.errors");

/**
 * Strict ISO-8601 regex pattern.
 * Supports:
 * - YYYY-MM-DD
 * - YYYY-MM-DDTHH:mm:ss
 * - YYYY-MM-DDTHH:mm:ssZ
 * - YYYY-MM-DDTHH:mm:ss.sssZ
 */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

/**
 * Checks if a value is defined, non-null, and non-empty.
 *
 * @param {*} value
 * @returns {boolean}
 * @private
 */
function hasValue(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

/**
 * Normalizes salesOrderIds from a string or array into a unique array of non-empty strings.
 *
 * @param {*} rawInput
 * @returns {string[]|null}
 * @throws {ValidationError}
 * @private
 */
function normalizeSalesOrderIds(rawInput) {
  if (!hasValue(rawInput)) {
    return null;
  }

  let candidates = [];
  if (typeof rawInput === "string") {
    candidates = rawInput.split(",");
  } else if (Array.isArray(rawInput)) {
    candidates = rawInput;
  } else {
    throw new ValidationError("salesOrderIds must be a comma-separated string or an array of order IDs.");
  }

  const uniqueIds = new Set();
  for (let i = 0; i < candidates.length; i++) {
    const trimmed = String(candidates[i]).trim();
    if (trimmed.length > 0) {
      uniqueIds.add(trimmed);
    }
  }

  return uniqueIds.size > 0 ? Array.from(uniqueIds) : null;
}

/**
 * Validates and parses a raw ISO-8601 date string into a Date object.
 * Checks against both regex format and calendar date roll-over (e.g. 2026-02-30).
 *
 * @param {string} dateString Raw date input string
 * @param {string} paramName Parameter name for error messages
 * @returns {{dateObj: Date, rawString: string}} Validated Date object and string
 * @throws {ValidationError}
 * @private
 */
function parseIsoDate(dateString, paramName) {
  const trimmed = String(dateString).trim();

  if (!ISO_8601_REGEX.test(trimmed)) {
    throw new ValidationError(
      `${paramName} must be a valid ISO-8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ).`
    );
  }

  const dateObj = new Date(trimmed);
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError(
      `${paramName} must be a valid ISO-8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ).`
    );
  }

  // Calendar validity check: V8 auto-rolls impossible dates (e.g. "2026-02-30" -> "2026-03-02")
  const isoDatePart = dateObj.toISOString().slice(0, 10);
  const inputDatePart = trimmed.slice(0, 10);
  if (isoDatePart !== inputDatePart) {
    throw new ValidationError(
      `${paramName} must be a valid ISO-8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ).`
    );
  }

  return { dateObj, rawString: trimmed };
}

/**
 * Enterprise-grade validator for HTTP query parameters in MRP planning requests.
 *
 * **Validation Rules**:
 * - `salesOrderIds`: Normalizes comma-separated strings or arrays into deduplicated, non-empty order ID strings.
 * - `requiredDateFrom`: Validates strict ISO-8601 date format and calendar correctness.
 * - `requiredDateTo`: Validates strict ISO-8601 date format and calendar correctness.
 * - `Range Invariant`: Enforces `requiredDateFrom <= requiredDateTo`.
 * - Undefined or empty query parameters are safely ignored.
 *
 * @param {Object} [query={}] HTTP request query parameters
 * @returns {{salesOrderIds?: string[], requiredDateFrom?: string, requiredDateTo?: string}} Validated filters object
 * @throws {ValidationError} HTTP 400 validation error
 */
function validatePlanningQuery(query = {}) {
  const filters = {};

  if (!query || typeof query !== "object") {
    return filters;
  }

  // 1. Normalize salesOrderIds
  if (hasValue(query.salesOrderIds)) {
    const normalizedIds = normalizeSalesOrderIds(query.salesOrderIds);
    if (normalizedIds) {
      filters.salesOrderIds = normalizedIds;
    }
  }

  let fromDateObj = null;
  let toDateObj = null;

  // 2. Parse requiredDateFrom
  if (hasValue(query.requiredDateFrom)) {
    const parsedFrom = parseIsoDate(query.requiredDateFrom, "requiredDateFrom");
    fromDateObj = parsedFrom.dateObj;
    filters.requiredDateFrom = parsedFrom.rawString;
  }

  // 3. Parse requiredDateTo
  if (hasValue(query.requiredDateTo)) {
    const parsedTo = parseIsoDate(query.requiredDateTo, "requiredDateTo");
    toDateObj = parsedTo.dateObj;
    filters.requiredDateTo = parsedTo.rawString;
  }

  // 4. Validate date range invariant (requiredDateFrom <= requiredDateTo)
  if (fromDateObj && toDateObj) {
    if (fromDateObj.getTime() > toDateObj.getTime()) {
      throw new ValidationError("requiredDateFrom cannot be later than requiredDateTo.");
    }
  }

  return filters;
}

module.exports = {
  validatePlanningQuery,
};
