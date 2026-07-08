// src/sales/sales.validation.js

const VALID_STATUS = [
  "Pending",
  "Completed",
  "Cancelled",
];

// =============================
// Validate Sales Order ID
// Used by GET BY ID, PUT, DELETE
// =============================
function validateSalesOrderId(id) {
  if (!id) {
    return "Sales Order ID is required.";
  }

  if (typeof id !== "string") {
    return "Sales Order ID must be a string.";
  }

  if (id.trim() === "") {
    return "Sales Order ID cannot be empty.";
  }

  return null;
}

// =============================
// Validate POST Request
// =============================
function validateCreateSalesOrder(body) {
  if (!body) {
    return "Request body is required.";
  }

  const {
    salesOrderId,
    customerId,
    orderDate,
    status,
  } = body;

  // Sales Order ID
  if (!salesOrderId) {
    return "Sales Order ID is required.";
  }

  if (typeof salesOrderId !== "string") {
    return "Sales Order ID must be a string.";
  }

  if (salesOrderId.trim() === "") {
    return "Sales Order ID cannot be empty.";
  }

  // Customer ID
  if (!customerId) {
    return "Customer ID is required.";
  }

  if (typeof customerId !== "string") {
    return "Customer ID must be a string.";
  }

  if (customerId.trim() === "") {
    return "Customer ID cannot be empty.";
  }

  // Order Date
  if (!orderDate) {
    return "Order Date is required.";
  }

  if (isNaN(new Date(orderDate).getTime())) {
    return "Order Date is invalid.";
  }

  // Status
  if (!status) {
    return "Status is required.";
  }

  if (typeof status !== "string") {
    return "Status must be a string.";
  }

  if (!VALID_STATUS.includes(status)) {
    return `Status must be one of: ${VALID_STATUS.join(", ")}.`;
  }

  return null;
}

// =============================
// Validate PUT Request
// Only validate fields that exist
// =============================
function validateUpdateSalesOrder(body) {
  if (!body) {
    return "Request body is required.";
  }

  // Customer ID
  if (body.customerId !== undefined) {
    if (typeof body.customerId !== "string") {
      return "Customer ID must be a string.";
    }

    if (body.customerId.trim() === "") {
      return "Customer ID cannot be empty.";
    }
  }

  // Order Date
  if (body.orderDate !== undefined) {
    if (isNaN(new Date(body.orderDate).getTime())) {
      return "Order Date is invalid.";
    }
  }

  // Status
  if (body.status !== undefined) {
    if (typeof body.status !== "string") {
      return "Status must be a string.";
    }

    if (!VALID_STATUS.includes(body.status)) {
      return `Status must be one of: ${VALID_STATUS.join(", ")}.`;
    }
  }

  return null;
}

module.exports = {
  validateSalesOrderId,
  validateCreateSalesOrder,
  validateUpdateSalesOrder,
};