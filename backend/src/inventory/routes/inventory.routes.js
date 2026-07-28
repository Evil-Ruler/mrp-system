// src/inventory/routes/inventory.routes.js
const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventory.controller");

router.get("/", inventoryController.getAllInventory);
router.get("/:id", inventoryController.getInventoryById);

router.post("/create", inventoryController.createInventoryItem);

router.put("/:id", inventoryController.updateInventoryItem);

router.delete("/:id", inventoryController.deleteInventoryItem);

router.post("/stock", inventoryController.getInventoryStock);

module.exports = router;