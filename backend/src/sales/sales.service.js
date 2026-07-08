const salesRepository = require("./sales.repository");

async function getAllSalesOrders() {
  return salesRepository.getAllSalesOrders();
}

async function getSalesOrderById(id) {
  return salesRepository.getSalesOrderById(id);
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
};