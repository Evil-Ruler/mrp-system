// src/inventory/services/inventory.service.js

const inventoryRepository = require("../repositories/inventory.repository");

// Service functions for inventory management
async function getAllInventory() {
  return await inventoryRepository.getAllInventory();
}

// Service function to get inventory item by ID
async function getInventoryById(id) {
  return inventoryRepository.getInventoryById(id);
}

// Service function to create a new inventory item with validation
async function createInventoryItem(itemData) {
    const existingItem =
        await inventoryRepository.getItemByCode(
            itemData.itemCode
        );

    if (existingItem) {
        throw new Error("ITEM_CODE_EXISTS");
    }

    if (itemData.purchaseRate < 0) {
        throw new Error("INVALID_PURCHASE_RATE");
    }

    if (
        itemData.sellingPrice !== undefined && itemData.category !== "Raw Material" &&
        itemData.sellingPrice < 0
    ) {
        throw new Error("INVALID_SELLING_PRICE");
    }

    if (itemData.reorderLevel < 0) {
        throw new Error("INVALID_REORDER_LEVEL");
    }

    if (
        itemData.sellingPrice !== undefined && itemData.category !== "Raw Material" &&
        itemData.sellingPrice < itemData.purchaseRate
    ) {
        throw new Error("INVALID_SELLING_PRICE_RULE");
    }

    itemData.currentStock = 0;

    return inventoryRepository.createInventoryItem(itemData);
}


// Service function to update an existing inventory item with validation
async function updateInventoryItem(
    id,
    itemData
) {

    const existingItem =
        await inventoryRepository.getInventoryById(id);

    if (!existingItem) {
        throw new Error("ITEM_NOT_FOUND");
    }

    if (itemData.purchaseRate < 0) {
        throw new Error("INVALID_PURCHASE_RATE");
    }

    if (itemData.sellingPrice !== undefined && itemData.category !== "Raw Material" && itemData.sellingPrice < 0) {
        throw new Error("INVALID_SELLING_PRICE");
    }

    if (itemData.reorderLevel < 0) {
        throw new Error("INVALID_REORDER_LEVEL");
    }

    if (
        itemData.sellingPrice !== undefined && itemData.category !== "Raw Material" &&
        itemData.sellingPrice < itemData.purchaseRate
    ) {
        throw new Error(
            "INVALID_SELLING_PRICE_RULE"
        );
    }

    return inventoryRepository.updateInventoryItem(
        id,
        itemData
    );
}

// Service function to delete an inventory item by ID
async function deleteInventoryItem(id) {
    return inventoryRepository.deleteInventoryItem(id);
}

// Service function to get inventory stock for a list of item IDs
async function getInventoryStock(itemIds) {

    const stock =
        await inventoryRepository.getInventoryStock(itemIds);

    const returnedIds =
        new Set(stock.map(item => item.itemId));

    const invalidItemIds =
        itemIds.filter(id => !returnedIds.has(id));

    if (invalidItemIds.length > 0) {

        const error = new Error(
            `Invalid itemId(s): ${invalidItemIds.join(", ")}`
        );

        error.statusCode = 404;

        throw error;
    }

    return stock;
}


module.exports = {
  getAllInventory,
  getInventoryById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryStock
};