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
async function updateSalesOrder(id, data) {
  return salesRepository.updateSalesOrder(id, data);
}

async function deleteSalesOrder(id) {
  return salesRepository.deleteSalesOrder(id);
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};