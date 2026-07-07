import { Request, Response } from "express";
import * as salesService from "./sales.service";

export async function getAllSalesOrders(
  req: Request,
  res: Response
) {
  try {
    const salesOrders =
      await salesService.getAllSalesOrders();

    return res.status(200).json(salesOrders);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch sales orders",
    });
  }
}

export async function getSalesOrderById(
  req: Request,
  res: Response
) {}

export async function createSalesOrder(
  req: Request,
  res: Response
) {}

export async function updateSalesOrder(
  req: Request,
  res: Response
) {}

export async function deleteSalesOrder(
  req: Request,
  res: Response
) {}