export async function getAllSalesOrders() {
  return [
    {
      salesOrderId: 1,
      customerId: 101,
      orderDate: "2026-07-04",
      status: "OPEN",
    },
    {
      salesOrderId: 2,
      customerId: 102,
      orderDate: "2026-07-05",
      status: "CLOSED",
    },
  ];
}