/**
 * Pure mapping function creating an immutable inventory planning snapshot.
 * Establishes a clean architectural boundary between repository data access
 * and planning engine execution.
 *
 * Performs zero business logic, zero clamping, zero validation, and zero sorting.
 * Preserves exact field values and input ordering while returning new object instances.
 *
 * @param {import("./inventoryNetting").InventoryRecord[]} inventory Array of inventory domain records
 * @returns {import("./inventoryNetting").InventoryRecord[]} Fresh array of isolated inventory snapshot objects
 */
function createInventorySnapshot(inventory) {
  const snapshot = new Array(inventory.length);
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    snapshot[i] = {
      itemId: item.itemId,
      availableQuantity: item.availableQuantity,
      onHandQuantity: item.onHandQuantity,
      reorderLevel: item.reorderLevel,
    };
  }
  return snapshot;
}

module.exports = {
  createInventorySnapshot,
};
