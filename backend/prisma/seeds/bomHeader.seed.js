const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedBOMHeaders(prisma) {

    const bomHeaders = [];
    const filePath = path.join(__dirname, "../../data/bom_headers.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                bomHeaders.push({
                    bomId: row.bom_id,
                    finishedGoodId: parseInt(row.finished_good_id)
                });

            })

            .on("end", async () => {

                try {

                    await prisma.bOMHeader.createMany({
                        data: bomHeaders,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${bomHeaders.length} BOM Headers inserted successfully.`);
                    resolve();

                } catch (error) {
                    reject(error);
                }

            })

            .on("error", reject);

    });

}

module.exports = seedBOMHeaders;