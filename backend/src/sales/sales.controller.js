const salesService = require("./sales.service");

const {
  validateSalesOrderId,
  validateCreateSalesOrder,
  validateUpdateSalesOrder,
} = require("./sales.validation");

// ======================================
// GET ALL SALES ORDERS
// ======================================
async function getAllSalesOrders(req, res) {
  try {
    const orders = await salesService.getAllSalesOrders();

    return res.status(200).json(orders);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// GET SALES ORDER BY ID
// ======================================
async function getSalesOrderById(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateSalesOrderId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const order = await salesService.getSalesOrderById(id);

    if (!order) {
      return res.status(404).json({
        message: "Sales Order not found.",
      });
    }

    return res.status(200).json(order);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// CREATE SALES ORDER
// ======================================
async function createSalesOrder(req, res) {
  try {
    const validationError = validateCreateSalesOrder(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const salesOrder = await salesService.createSalesOrder(req.body);

    return res.status(201).json(salesOrder);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// UPDATE SALES ORDER
// ======================================
async function updateSalesOrder(req, res) {
  try {
    const { id } = req.params;

    let validationError = validateSalesOrderId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    validationError = validateUpdateSalesOrder(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const updatedOrder = await salesService.updateSalesOrder(
      id,
      req.body
    );

    return res.status(200).json(updatedOrder);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// DELETE SALES ORDER
// ======================================
async function deleteSalesOrder(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateSalesOrderId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    await salesService.deleteSalesOrder(id);

    return res.status(204).send();

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};