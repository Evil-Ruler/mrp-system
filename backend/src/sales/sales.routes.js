const express = require("express");

const {
  getAllSalesOrders,
  getSalesOrderById,
} = require("./sales.controller");

const router = express.Router();

router.get("/sales-orders", getAllSalesOrders);
router.get("/sales-orders/:id", getSalesOrderById);

module.exports = router;