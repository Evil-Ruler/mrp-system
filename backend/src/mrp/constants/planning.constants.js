const ALLOWED_DEMAND_STATUSES = Object.freeze([
  "APPROVED",
  "CONFIRMED",
  "RELEASED",
]);

/**
 * Hard upper bound on the number of exploded component requirements a single
 * planning run may generate. Acts as a deterministic safety guardrail against a
 * pathologically large (deep/wide) BOM graph exhausting memory. Chosen well above
 * any realistic Phase 3 workload so normal planning behavior is never affected.
 */
const MAX_EXPLODED_REQUIREMENTS = 500000;

module.exports = {
  ALLOWED_DEMAND_STATUSES,
  MAX_EXPLODED_REQUIREMENTS,
};
