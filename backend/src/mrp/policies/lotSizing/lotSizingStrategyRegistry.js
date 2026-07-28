const { LOT_SIZING_POLICIES } = require("../../constants/lotSizing.constants");
const { ValidationError } = require("../../errors/mrp.errors");
const L4LStrategy = require("./L4LStrategy");
const FOQStrategy = require("./FOQStrategy");
const MOQStrategy = require("./MOQStrategy");
const OrderMultipleStrategy = require("./OrderMultipleStrategy");

/**
 * Strategy Registry mapping Lot Sizing Policy keys to Strategy implementations.
 */
class LotSizingStrategyRegistry {
  constructor() {
    this._strategies = new Map();

    // Default strategy registrations
    this.registerStrategy(LOT_SIZING_POLICIES.L4L, new L4LStrategy());
    this.registerStrategy(LOT_SIZING_POLICIES.FOQ, new FOQStrategy());
    this.registerStrategy(LOT_SIZING_POLICIES.MOQ, new MOQStrategy());
    this.registerStrategy(LOT_SIZING_POLICIES.ORDER_MULTIPLE, new OrderMultipleStrategy());
  }

  /**
   * Registers a strategy instance for a specific policy key.
   *
   * @param {string} policyKey Policy key from LOT_SIZING_POLICIES
   * @param {Object} strategy Strategy instance implementing calculate(shortage, itemConfig)
   */
  registerStrategy(policyKey, strategy) {
    if (typeof policyKey === "string" && strategy && typeof strategy.calculate === "function") {
      this._strategies.set(policyKey.toUpperCase(), strategy);
    }
  }

  /**
   * Resolves strategy instance for a given policy key.
   * Defaults to L4L strategy if policyKey is null/undefined.
   * Throws ValidationError if explicit policyKey is unrecognized.
   *
   * @param {string} [policyKey] Policy key string
   * @returns {Object} Strategy object with calculate() method
   * @throws {ValidationError} If policyKey is provided but unmapped
   */
  getStrategy(policyKey) {
    if (policyKey === undefined || policyKey === null || String(policyKey).trim() === "") {
      return this._strategies.get(LOT_SIZING_POLICIES.L4L);
    }

    const key = String(policyKey).trim().toUpperCase();
    const strategy = this._strategies.get(key);
    if (!strategy) {
      throw new ValidationError(`Unknown or unsupported lot sizing policy "${policyKey}".`);
    }

    return strategy;
  }
}

module.exports = new LotSizingStrategyRegistry();
