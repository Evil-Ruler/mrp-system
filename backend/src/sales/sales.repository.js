const prisma = require("../lib/prisma");

async function getAllSalesOrders() {
  return prisma.salesOrder.findMany();
}

async function getSalesOrderById(id) {
  return prisma.salesOrder.findUnique({
    where: {
      salesOrderId: id,
    },
  });
}
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
async function updateSalesOrder(id, data) {
  return prisma.salesOrder.update({
    where: {
      salesOrderId: id,
    },
    data,
  });
}
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
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};