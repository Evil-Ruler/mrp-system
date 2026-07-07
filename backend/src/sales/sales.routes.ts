console.log("Sales routes loaded");
import { Router } from "express";

import {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
} from "./sales.controller";

const router = Router();

router.get("/sales-orders", getAllSalesOrders);

router.get("/sales-orders/:id", getSalesOrderById);

router.post("/sales-orders", createSalesOrder);

router.put("/sales-orders/:id", updateSalesOrder);

router.delete("/sales-orders/:id", deleteSalesOrder);

export default router;