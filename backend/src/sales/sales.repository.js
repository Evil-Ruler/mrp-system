const prisma = require("../lib/prisma");

// =============================
// GET ALL SALES ORDERS
// =============================
async function getAllSalesOrders() {
  return prisma.salesOrder.findMany();
}

// =============================
// GET SALES ORDER BY ID
// =============================
async function getSalesOrderById(id) {
  return prisma.salesOrder.findUnique({
    where: {
      salesOrderId: id,
    },
  });
}

// =============================
// GET CUSTOMER BY ID
// =============================
async function getCustomerById(customerId) {
  return prisma.customer.findUnique({
    where: {
      customerId,
    },
  });
}

// =============================
// CREATE SALES ORDER
// =============================
async function createSalesOrder(data) {
  return prisma.salesOrder.create({
    data: {
      salesOrderId: data.salesOrderId,
      customerId: data.customerId,
      orderDate: new Date(data.orderDate),
      status: data.status,
    },
  });
}

// =============================
// UPDATE SALES ORDER
// =============================
async function updateSalesOrder(id, data) {
  return prisma.salesOrder.update({
    where: {
      salesOrderId: id,
    },
    data,
  });
}

// =============================
// DELETE SALES ORDER
// =============================
async function deleteSalesOrder(id) {
  return prisma.salesOrder.delete({
    where: {
      salesOrderId: id,
    },
  });
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  getCustomerById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};