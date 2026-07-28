const { applyMinPlanningQuantity } = require("./minPlanningQuantityModifier");
const { applyMaxOrderQuantity } = require("./maxOrderQuantityModifier");

/**
 * Order Modifier Strategy Registry.
 *
 * Manages an ordered chain of modifier strategies executing in strict precedence order:
 * Precedence 1: Minimum Planning Quantity Modifier
 * Precedence 2: Maximum Order Quantity Modifier
 */
class OrderModifierRegistry {
  constructor() {
    this.modifiers = [
      { name: "MINIMUM_PLANNING_QUANTITY", handler: applyMinPlanningQuantity, precedence: 1 },
      { name: "MAXIMUM_ORDER_QUANTITY", handler: applyMaxOrderQuantity, precedence: 2 },
    ];
  }

  /**
   * Registers a new order modifier strategy into the execution pipeline.
   *
   * @param {Object|Function} modifier Strategy object or handler function
   */
  register(modifier) {
    if (typeof modifier === "function") {
      this.modifiers.push({ name: modifier.name || "CUSTOM", handler: modifier, precedence: this.modifiers.length + 1 });
    } else if (modifier && typeof modifier.handler === "function") {
      this.modifiers.push(modifier);
      this.modifiers.sort((a, b) => (a.precedence || 0) - (b.precedence || 0));
    }
  }

  /**
   * Executes the registered modifier chain sequentially over an initial lot-sized order quantity.
   *
   * @param {number} initialQuantity Lot-sized base quantity from Stage 4A
   * @param {Object} [itemConfig] Item planning DTO
   * @returns {{quantity: number, modifierReason: string|null}[]} Array of modified order quantity entries with modifierReason
   */
  executeChain(initialQuantity, itemConfig = {}) {
    if (typeof initialQuantity !== "number" || initialQuantity <= 0) {
      return [{ quantity: 0, modifierReason: null }];
    }

    let currentItems = [{ quantity: initialQuantity, modifierReason: null }];

    for (let i = 0; i < this.modifiers.length; i++) {
      const modifier = this.modifiers[i];
      const nextItems = [];

      for (let j = 0; j < currentItems.length; j++) {
        const item = currentItems[j];
        const result = modifier.handler(item.quantity, itemConfig);

        for (let k = 0; k < result.quantities.length; k++) {
          nextItems.push({
            quantity: result.quantities[k],
            modifierReason: result.modifierReason || item.modifierReason,
          });
        }
      }

      currentItems = nextItems;
    }

    return currentItems;
  }
}

const defaultRegistry = new OrderModifierRegistry();

module.exports = {
  OrderModifierRegistry,
  defaultRegistry,
};
