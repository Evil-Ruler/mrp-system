const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedSalesOrders(prisma) {

    const salesOrders = [];
    const filePath = path.join(__dirname, "../../data/sales_orders.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                salesOrders.push({
                    salesOrderId: row.sales_order_id,
                    customerId: row.customer_id,
                    orderDate: new Date(row.order_date),
                    status: row.status
                });

            })

            .on("end", async () => {

                try {

                    await prisma.salesOrder.createMany({
                        data: salesOrders,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${salesOrders.length} Sales Orders inserted successfully.`);
                    resolve();

                } catch (error) {
                    reject(error);
                }

            })

            .on("error", reject);

    });

}

module.exports = seedSalesOrders;