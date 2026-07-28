// src/inventory/repositories/inventory.repository.js

const prisma = require("../../config/prisma");

// Function to get all inventory items
async function getAllInventory() {
  return await prisma.item.findMany({
  select: {
    itemId: true,
    itemCode: true,
    itemName: true,
    category: true,
    uom: true,
    currentStock: true,
    reorderLevel: true,
  },
  orderBy: {
    itemId: "asc",
  },
})};

// Function to get an inventory item by its ID
async function getInventoryById(id) {
  return prisma.item.findUnique({
    where: {
      itemId: id,
    },
    select: {
      itemId: true,
      itemCode: true,
      itemName: true,
      category: true,
      uom: true,
      currentStock: true,
      reorderLevel: true,
      purchaseRate: true,
      sellingPrice: true,
      preferredSupplier: true,
    },
  });
}


// Function to get an inventory item by its itemCode
async function getItemByCode(itemCode) {
    return prisma.item.findUnique({
        where: {
            itemCode,
        },
    });
}

// Function to create a new inventory item
async function createInventoryItem(itemData) {
    return prisma.item.create({
        data: itemData,
    });
}



// Function to update an existing inventory item
async function updateInventoryItem(
    id,
    itemData
) {
    return prisma.item.update({
        where: {
            itemId: id,
        },
        data: {
            itemName: itemData.itemName,
            category: itemData.category,
            uom: itemData.uom,
            purchaseRate: itemData.purchaseRate,
            sellingPrice: itemData.sellingPrice,
            reorderLevel: itemData.reorderLevel,
            preferredSupplier:
                itemData.preferredSupplier,
        },
    });
}

// Function to delete an inventory item by its ID
async function deleteInventoryItem(id) {
    return prisma.item.delete({
        where: {
            itemId: id,
        },
    });
}

// Function to get the current stock of multiple inventory items by their IDs
async function getInventoryStock(itemIds) {

    return prisma.item.findMany({

        where: {
            itemId: {
                in: itemIds,
            },
        },

        select: {
            itemId: true,
            currentStock: true,
        },
        orderBy: {
            itemId: "asc",
        },

    });

}




module.exports = {
  getAllInventory,
  getInventoryById,
  getItemByCode,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryStock
};