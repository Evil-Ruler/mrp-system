/**
 * Enterprise MRP System Lot Sizing Policy Constants.
 *
 * Centralized enumeration and valid Set for lot sizing strategies consumed
 * across data repositories, validation rules, policy strategies, and planning engine.
 */

const LOT_SIZING_POLICIES = Object.freeze({
  L4L: "L4L",
  FOQ: "FOQ",
  MOQ: "MOQ",
  ORDER_MULTIPLE: "ORDER_MULTIPLE",
});

const VALID_LOT_SIZING_POLICIES = Object.freeze(
  new Set([
    LOT_SIZING_POLICIES.L4L,
    LOT_SIZING_POLICIES.FOQ,
    LOT_SIZING_POLICIES.MOQ,
    LOT_SIZING_POLICIES.ORDER_MULTIPLE,
  ])
);

module.exports = {
  LOT_SIZING_POLICIES,
  VALID_LOT_SIZING_POLICIES,
};
