const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function seedBOMLines(prisma) {

    const bomLines = [];
    const filePath = path.join(__dirname, "../../data/bom_lines.csv");

    return new Promise((resolve, reject) => {

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                bomLines.push({
                    bomLineId: parseInt(row.bom_line_id),
                    bomId: row.bom_id,
                    materialId: parseInt(row.material_id),
                    quantityRequired: parseFloat(row.quantity_required)
                });

            })

            .on("end", async () => {

                try {

                    await prisma.bOMLine.createMany({
                        data: bomLines,
                        skipDuplicates: true
                    });

                    console.log(`✅ ${bomLines.length} BOM Lines inserted successfully.`);
                    resolve();

                } catch (error) {

                    reject(error);

                }

            })

            .on("error", reject);

    });

}

module.exports = seedBOMLines;