// Represents one product inside a sales order
export interface SalesOrderItemDTO {
  productId: number;
  quantity: number;
}

// Request body for POST /sales
export interface CreateSalesOrderDTO {
  customerId: number;
  expectedDelivery: string;
  items: SalesOrderItemDTO[];
}

// API response after creating an order
export interface CreateSalesOrderResponseDTO {
  salesOrderId: number;
  status: string;
}