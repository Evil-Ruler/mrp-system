const salesRepository = require("./sales.repository");

async function getAllSalesOrders() {
  return salesRepository.getAllSalesOrders();
}

async function getSalesOrderById(id) {
  return salesRepository.getSalesOrderById(id);
}

async function createSalesOrder(data) {
  return salesRepository.createSalesOrder(data);
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
};