/**
 * Enterprise MRP System Procurement Type Constants.
 *
 * Centralized enumeration and valid Set for procurement strategies consumed
 * across data repositories, validation rules, policy resolvers, and planning engine.
 */

const PROCUREMENT_TYPES = Object.freeze({
  PURCHASE: "PURCHASE",
  PRODUCTION: "PRODUCTION",
});

const VALID_PROCUREMENT_TYPES = Object.freeze(
  new Set([PROCUREMENT_TYPES.PURCHASE, PROCUREMENT_TYPES.PRODUCTION])
);

module.exports = {
  PROCUREMENT_TYPES,
  VALID_PROCUREMENT_TYPES,
};
