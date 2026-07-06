/*
  Warnings:

  - The primary key for the `items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `item_id` on the `items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "items" DROP CONSTRAINT "items_pkey",
DROP COLUMN "item_id",
ADD COLUMN     "item_id" INTEGER NOT NULL,
ADD CONSTRAINT "items_pkey" PRIMARY KEY ("item_id");

-- CreateTable
CREATE TABLE "sales_orders" (
    "sales_order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("sales_order_id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "purchase_order_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("purchase_order_id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "production_order_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("production_order_id")
);

-- CreateTable
CREATE TABLE "bom_headers" (
    "bom_id" TEXT NOT NULL,
    "finished_good_id" INTEGER NOT NULL,

    CONSTRAINT "bom_headers_pkey" PRIMARY KEY ("bom_id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "bom_line_id" INTEGER NOT NULL,
    "bom_id" TEXT NOT NULL,
    "material_id" INTEGER NOT NULL,
    "quantity_required" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("bom_line_id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "sales_order_line_id" INTEGER NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("sales_order_line_id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "purchase_order_line_id" INTEGER NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "material_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("purchase_order_line_id")
);

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("sales_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_finished_good_id_fkey" FOREIGN KEY ("finished_good_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bom_headers"("bom_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("sales_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("purchase_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
