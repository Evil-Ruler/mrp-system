const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedProductionOrders(prisma) {

    const productionOrders = [];
    const filePath = path.join(__dirname, "../../data/production_orders.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                productionOrders.push({
                    productionOrderId: row.production_order_id,
                    salesOrderId: row.sales_order_id,
                    productId: parseInt(row.product_id),
                    quantity: parseInt(row.quantity),
                    startDate: new Date(row.start_date),
                    status: row.status
                });

            })

            .on("end", async () => {

                try {

                    await prisma.productionOrder.createMany({
                        data: productionOrders,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${productionOrders.length} Production Orders inserted successfully.`);
                    resolve();

                } catch (error) {
                    reject(error);
                }

            })

            .on("error", reject);

    });

}

module.exports = seedProductionOrders;