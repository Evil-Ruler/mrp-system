import * as salesRepository from "./sales.repository";

export async function getAllSalesOrders() {
  console.log("Service hit");
  return await salesRepository.getAllSalesOrders();
}