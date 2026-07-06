const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedPurchaseOrderLines(prisma) {

    const purchaseOrderLines = [];
    const filePath = path.join(__dirname, "../../data/purchase_order_lines.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                purchaseOrderLines.push({
                    purchaseOrderLineId: parseInt(row.purchase_order_line_id),
                    purchaseOrderId: row.purchase_order_id,
                    materialId: parseInt(row.material_id),
                    quantity: parseInt(row.quantity)
                });

            })

            .on("end", async () => {

                try {

                    await prisma.purchaseOrderLine.createMany({
                        data: purchaseOrderLines,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${purchaseOrderLines.length} Purchase Order Lines inserted successfully.`);
                    resolve();

                } catch (error) {

                    reject(error);

                }

            })

            .on("error", reject);

    });

}

module.exports = seedPurchaseOrderLines;