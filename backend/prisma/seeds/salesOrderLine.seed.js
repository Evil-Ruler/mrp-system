const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedSalesOrderLines(prisma) {

    const salesOrderLines = [];
    const filePath = path.join(__dirname, "../../data/sales_order_lines.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                salesOrderLines.push({
                    salesOrderLineId: parseInt(row.sales_order_line_id),
                    salesOrderId: row.sales_order_id,
                    productId: parseInt(row.product_id),
                    quantity: parseInt(row.quantity)
                });

            })

            .on("end", async () => {

                try {

                    await prisma.salesOrderLine.createMany({
                        data: salesOrderLines,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${salesOrderLines.length} Sales Order Lines inserted successfully.`);
                    resolve();

                } catch (error) {

                    reject(error);

                }

            })

            .on("error", reject);

    });

}

module.exports = seedSalesOrderLines;