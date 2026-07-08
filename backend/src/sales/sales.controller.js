const salesService = require("./sales.service");

async function getAllSalesOrders(req, res) {
  try {
    const orders = await salesService.getAllSalesOrders();

    return res.status(200).json(orders);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getSalesOrderById(req, res) {
  try {
    const { id } = req.params;

    const order = await salesService.getSalesOrderById(id);

    if (!order) {
      return res.status(404).json({
        message: "Sales order not found",
      });
    }

    return res.status(200).json(order);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
};