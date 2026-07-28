// src/inventory/controllers/inventory.controller.js

const inventoryService = require("../services/inventory.service");

// Controller function to get all inventory items
async function getAllInventory(req, res, next) {
  try {
    const items = await inventoryService.getAllInventory();

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
}


// Controller function to get an inventory item by ID
async function getInventoryById(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory item ID",
      });
    }

    const item = await inventoryService.getInventoryById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

// Controller function to create a new inventory item with validation
async function createInventoryItem(req, res, next) {
    try {
        const {
            itemCode,
            itemName,
            category,
            uom,
            purchaseRate,
            sellingPrice,
            reorderLevel,
            preferredSupplier,
        } = req.body;

        const errors = [];

        // Required fields
        if (!itemCode) errors.push("itemCode is required.");
        if (!itemName) errors.push("itemName is required.");
        if (!category) errors.push("category is required.");
        if (!uom) errors.push("uom is required.");
        if (purchaseRate === undefined) errors.push("purchaseRate is required.");
        if (reorderLevel === undefined) errors.push("reorderLevel is required.");

        // Type validation
        if (
            purchaseRate !== undefined &&
            typeof purchaseRate !== "number"
        ) {
            errors.push("purchaseRate must be a number.");
        }

        if (
            sellingPrice !== undefined &&
            typeof sellingPrice !== "number"
        ) {
            errors.push("sellingPrice must be a number.");
        }

        if (
            reorderLevel !== undefined &&
            typeof reorderLevel !== "number"
        ) {
            errors.push("reorderLevel must be a number.");
        }

        // Category validation
        const validCategories = [
            "Finished Goods",
            "Raw Material",
            "Hardware",
            "Consumable",
        ];

        if (
            category &&
            !validCategories.includes(category)
        ) {
            errors.push("Invalid category.");
        }

        // UOM validation
        const validUoms = [
            "Nos",
            "Kg",
            "Litre",
            "Meter",
            "Box",
        ];

        if (uom && !validUoms.includes(uom)) {
            errors.push("Invalid UOM.");
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
            });
        }

        const item = await inventoryService.createInventoryItem({
            itemCode,
            itemName,
            category,
            uom,
            purchaseRate,
            sellingPrice,
            reorderLevel,
            preferredSupplier,
        });

        return res.status(201).json({
            success: true,
            message: "Inventory item created successfully.",
            data: item,
        });
    } catch (error) {
        switch (error.message) {
            case "ITEM_CODE_EXISTS":
                return res.status(409).json({
                    success: false,
                    message: "Item code already exists.",
                });

            case "INVALID_PURCHASE_RATE":
                return res.status(400).json({
                    success: false,
                    message: "Purchase rate cannot be negative.",
                });

            case "INVALID_SELLING_PRICE":
                return res.status(400).json({
                    success: false,
                    message: "Selling price cannot be negative.",
                });

            case "INVALID_REORDER_LEVEL":
                return res.status(400).json({
                    success: false,
                    message: "Reorder level cannot be negative.",
                });

            case "INVALID_SELLING_PRICE_RULE":
                return res.status(400).json({
                    success: false,
                    message:
                        "Selling price cannot be less than purchase rate.",
                });

            default:
                next(error);
        }
    }
}




// Controller function to update an inventory item
async function updateInventoryItem(req, res, next) {
    try {
        const id = Number(req.params.id);

        // Resource Validation
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory item ID",
            });
        }

        const {
            itemName,
            category,
            uom,
            purchaseRate,
            sellingPrice,
            reorderLevel,
            preferredSupplier,
        } = req.body;

        const errors = [];

        // Presence Validation
        if (!itemName) errors.push("itemName is required.");
        if (!category) errors.push("category is required.");
        if (!uom) errors.push("uom is required.");
        if (purchaseRate === undefined)
            errors.push("purchaseRate is required.");
        if (sellingPrice === undefined)
            errors.push("sellingPrice is required.");
        if (reorderLevel === undefined)
            errors.push("reorderLevel is required.");

        // Data Type Validation
        if (
            purchaseRate !== undefined &&
            typeof purchaseRate !== "number"
        ) {
            errors.push("purchaseRate must be a number.");
        }

        if (
            sellingPrice !== undefined &&
            typeof sellingPrice !== "number"
        ) {
            errors.push("sellingPrice must be a number.");
        }

        if (
            reorderLevel !== undefined &&
            typeof reorderLevel !== "number"
        ) {
            errors.push("reorderLevel must be a number.");
        }

        // Category Validation
        const validCategories = [
            "Finished Goods",
            "Raw Material",
            "Hardware",
            "Consumable",
        ];

        if (
            category &&
            !validCategories.includes(category)
        ) {
            errors.push("Invalid category.");
        }

        // UOM Validation
        const validUoms = [
            "Nos",
            "Kg",
            "Litre",
            "Meter",
            "Box",
            "CFT",
            "Sqft",
            "Sheet",
            "Roll",
        ];

        if (
            uom &&
            !validUoms.includes(uom)
        ) {
            errors.push("Invalid UOM.");
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
            });
        }

        const updatedItem =
            await inventoryService.updateInventoryItem(
                id,
                {
                    itemName,
                    category,
                    uom,
                    purchaseRate,
                    sellingPrice,
                    reorderLevel,
                    preferredSupplier,
                }
            );

        return res.status(200).json({
            success: true,
            message:
                "Inventory item updated successfully.",
            data: updatedItem,
        });

    } catch (error) {

        switch (error.message) {

            case "ITEM_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Inventory item not found.",
                });

            case "INVALID_PURCHASE_RATE":
                return res.status(400).json({
                    success: false,
                    message:
                        "Purchase rate cannot be negative.",
                });

            case "INVALID_SELLING_PRICE":
                return res.status(400).json({
                    success: false,
                    message:
                        "Selling price cannot be negative.",
                });

            case "INVALID_REORDER_LEVEL":
                return res.status(400).json({
                    success: false,
                    message:
                        "Reorder level cannot be negative.",
                });

            case "INVALID_SELLING_PRICE_RULE":
                return res.status(400).json({
                    success: false,
                    message:
                        "Selling price cannot be less than purchase rate!!!!!.",
                });

            default:
                next(error);
        }
    }
}


// Controller function to delete an inventory item
async function deleteInventoryItem(req, res, next) {
    try {
        const id = Number(req.params.id);

        // Resource Validation
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory item ID.",
            });
        }

        // Check resource exists
        const itemExists = await inventoryService.getInventoryById(id);

        if (!itemExists) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found.",
            });
        }

        await inventoryService.deleteInventoryItem(id);

        return res.status(200).json({
            success: true,
            message: "Inventory item deleted successfully.",
        });

    } catch (error) {
        next(error);
    }
}


// Controller function to get inventory stock for given item IDs
async function getInventoryStock(req, res, next) {
    try {
        const { itemIds } = req.body;

        // Presence Validation
        if (!itemIds) {
            return res.status(400).json({
                success: false,
                message: "itemIds is required.",
            });
        }

        // Type Validation
        if (!Array.isArray(itemIds)) {
            return res.status(400).json({
                success: false,
                message: "itemIds must be an array.",
            });
        }

        if (itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "itemIds cannot be empty.",
            });
        }

        // Validate every ID
        const uniqueIds = new Set();

        for (const id of itemIds) {
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid itemId: ${id}`,
                });
            }

            if (uniqueIds.has(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate itemId: ${id}`,
                });
            }

            uniqueIds.add(id);
        }

        const stock =
            await inventoryService.getInventoryStock(itemIds);

        return res.status(200).json({
            success: true,
            data: stock,
        });

    } catch (error) {
        next(error);
    }
}


module.exports = {
  getAllInventory,
  getInventoryById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryStock
};