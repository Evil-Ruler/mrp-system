const { CATEGORY_TO_PROCUREMENT } = require("../constants/procurementPolicy.constants");

/**
 * Pure Procurement Type Resolver.
 *
 * Resolves domain procurement strategy ("PURCHASE" or "PRODUCTION") from a legacy item category.
 *
 * Responsibilities:
 * - Accept a category string
 * - Normalize whitespace/casing/hyphens
 * - Return the mapped procurement type, or null if unmapped/unknown
 *
 * Pure function guarantees:
 * - Zero persistence awareness
 * - Zero validation of explicit procurementType
 * - Zero repository exceptions
 * - Zero Prisma knowledge
 *
 * @param {string|null|undefined} category Persisted item category string
 * @returns {string | null}
 */
function resolveProcurementTypeFromCategory(category) {
  if (category === undefined || category === null) {
    return null;
  }

  const normalized = String(category).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return null;
  }

  return CATEGORY_TO_PROCUREMENT[normalized] || null;
}

module.exports = {
  resolveProcurementTypeFromCategory,
};
