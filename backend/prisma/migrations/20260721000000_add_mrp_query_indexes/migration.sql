-- Add indexes supporting the MRP repository read patterns (status/date filters,
-- ORDER BY columns, and the relation-join foreign keys traversed during planning).
-- These are production read-path optimizations only; no columns, tables, or
-- constraints are altered, so application/planning behavior is unchanged.

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_order_date_idx" ON "sales_orders"("order_date");

-- CreateIndex
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_product_id_idx" ON "sales_order_lines"("product_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_material_id_idx" ON "purchase_order_lines"("material_id");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_start_date_idx" ON "production_orders"("start_date");

-- CreateIndex
CREATE INDEX "bom_headers_finished_good_id_idx" ON "bom_headers"("finished_good_id");

-- CreateIndex
CREATE INDEX "bom_lines_bom_id_idx" ON "bom_lines"("bom_id");

-- CreateIndex
CREATE INDEX "bom_lines_material_id_idx" ON "bom_lines"("material_id");
