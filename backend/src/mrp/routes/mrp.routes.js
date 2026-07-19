const express = require("express");
const router = express.Router();
const controller = require("../controllers/mrp.controller");

router.get("/sales-orders", controller.getAllSalesOrders.bind(controller));

module.exports = router;
