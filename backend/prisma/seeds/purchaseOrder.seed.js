const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedPurchaseOrders(prisma) {

    const purchaseOrders = [];
    const filePath = path.join(__dirname, "../../data/purchase_orders.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                purchaseOrders.push({
                    purchaseOrderId: row.purchase_order_id,
                    supplierId: row.supplier_id,
                    orderDate: new Date(row.order_date),
                    status: row.status
                });

            })

            .on("end", async () => {

                try {

                    await prisma.purchaseOrder.createMany({
                        data: purchaseOrders,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${purchaseOrders.length} Purchase Orders inserted successfully.`);
                    resolve();

                } catch (error) {
                    reject(error);
                }

            })

            .on("error", reject);

    });

}

module.exports = seedPurchaseOrders;