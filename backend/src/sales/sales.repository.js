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

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
};