const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedSuppliers(prisma) {
    const suppliers = [];
    const filePath = path.join(__dirname, "../../data/suppliers.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                suppliers.push({
                    supplierId: row.supplier_id,
                    supplierName: row.supplier_name,
                    phone: row.phone,
                    email: row.email,
                    address: row.address,
                    leadTimeDays: parseInt(row.lead_time_days)
                });

            })

            .on("end", async () => {

                try {

                    await prisma.supplier.createMany({
                        data: suppliers,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${suppliers.length} suppliers inserted successfully.`);

                    resolve();

                } catch (error) {

                    reject(error);

                }

            })

            .on("error", (error) => {

                reject(error);

            });

    });
}

module.exports = seedSuppliers;