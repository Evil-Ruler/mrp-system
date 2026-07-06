const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedCustomers(prisma) {
    const customers = [];
    const filePath = path.join(__dirname, "../../data/customers.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {
                customers.push({
                    customerId: row.customer_id,
                    customerName: row.customer_name,
                    phone: row.phone,
                    email: row.email,
                    address: row.address,
                    gstin: row.gstin,
                    paymentTerms: row.payment_terms
                });
            })

            .on("end", async () => {
                try {
                    await prisma.customer.createMany({
                        data: customers,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${customers.length} customers inserted successfully.`);
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

module.exports = seedCustomers;