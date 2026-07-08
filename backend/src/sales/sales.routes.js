const express = require("express");

const {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
} = require("./sales.controller");

const router = express.Router();

router.get("/sales-orders", getAllSalesOrders);

router.get("/sales-orders/:id", getSalesOrderById);

router.post("/sales-orders", createSalesOrder);

module.exports = router;