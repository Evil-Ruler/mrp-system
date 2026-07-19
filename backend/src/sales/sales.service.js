const salesRepository = require("./sales.repository");

// =============================
// GET ALL SALES ORDERS
// =============================
async function getAllSalesOrders() {
  return salesRepository.getAllSalesOrders();
}

// =============================
// GET SALES ORDER BY ID
// =============================
async function getSalesOrderById(id) {
  return salesRepository.getSalesOrderById(id);
}

// =============================
// CREATE SALES ORDER
// =============================
async function createSalesOrder(data) {

  // Check customer exists
  const customer = await salesRepository.getCustomerById(data.customerId);

  if (!customer) {
    const error = new Error("Customer not found");
    error.status = 404;
    throw error;
  }

  // Check duplicate Sales Order ID
  const existingOrder = await salesRepository.getSalesOrderById(
    data.salesOrderId
  );

  if (existingOrder) {
    const error = new Error("Sales Order already exists");
    error.status = 409;
    throw error;
  }

  return salesRepository.createSalesOrder(data);
}

// =============================
// UPDATE SALES ORDER
// =============================
async function updateSalesOrder(id, data) {

  // Check Sales Order exists
  const existingOrder = await salesRepository.getSalesOrderById(id);

  if (!existingOrder) {
    const error = new Error("Sales Order not found");
    error.status = 404;
    throw error;
  }

  // If customerId is updated, verify customer exists
  if (data.customerId) {

    const customer = await salesRepository.getCustomerById(
      data.customerId
    );

    if (!customer) {
      const error = new Error("Customer not found");
      error.status = 404;
      throw error;
    }
  }

  return salesRepository.updateSalesOrder(id, data);
}

// =============================
// DELETE SALES ORDER
// =============================
async function deleteSalesOrder(id) {

  const existingOrder = await salesRepository.getSalesOrderById(id);

  if (!existingOrder) {
    const error = new Error("Sales Order not found");
    error.status = 404;
    throw error;
  }

  return salesRepository.deleteSalesOrder(id);
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};