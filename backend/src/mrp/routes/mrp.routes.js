const express = require("express");
const router = express.Router();
const controller = require("../controllers/mrp.controller");

/**
 * Express router exposing MRP REST API endpoints:
 * - GET /run          Executes full MRP engine pipeline
 * - GET /planning-data Loads raw validated planning dataset
 * - GET /sales-orders   Returns eligible open sales order demand lines
 */
router.get("/run", controller.runPlanning.bind(controller));
router.get("/planning-data", controller.getPlanningData.bind(controller));
router.get("/sales-orders", controller.getAllSalesOrders.bind(controller));

module.exports = router;
