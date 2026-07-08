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

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
};