const express = require("express");

const {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
} = require("./sales.controller");

const router = express.Router();

router.get("/sales-orders", getAllSalesOrders);

router.get("/sales-orders/:id", getSalesOrderById);

router.post("/sales-orders", createSalesOrder);

router.put("/sales-orders/:id", updateSalesOrder);

router.delete("/sales-orders/:id", deleteSalesOrder);

module.exports = router;