const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function readCSV(filePath) {
    return new Promise((resolve, reject) => {

        const items = [];

        fs.createReadStream(filePath)
            .pipe(csv())

            .on("data", (row) => {

                items.push({
                    itemId: parseInt(row.item_id),
                    itemCode: row.item_code,
                    itemName: row.item_name,
                    category: row.category,
                    uom: row.uom,
                    currentStock: parseInt(row.current_stock),
                    reorderLevel: parseInt(row.reorder_level),
                    purchaseRate: parseFloat(row.purchase_rate),

                    sellingPrice:
                        row.selling_price === ""
                            ? null
                            : parseFloat(row.selling_price),

                    preferredSupplier:
                        row.preferred_supplier === ""
                            ? null
                            : row.preferred_supplier
                });

            })

            .on("end", () => resolve(items))

            .on("error", reject);

    });
}

async function seedItems(prisma) {

    const rawMaterials = await readCSV(
        path.join(__dirname, "../../data/raw_materials.csv")
    );

    const hardware = await readCSV(
        path.join(__dirname, "../../data/hardware.csv")
    );

    const consumables = await readCSV(
        path.join(__dirname, "../../data/consumables.csv")
    );

    const finishedGoods = await readCSV(
        path.join(__dirname, "../../data/finished_goods.csv")
    );

    const items = [
        ...rawMaterials,
        ...hardware,
        ...consumables,
        ...finishedGoods
    ];

    await prisma.item.createMany({
        data: items,
        skipDuplicates: true
    });

    console.log(`✅ ${items.length} items inserted successfully.`);
}

module.exports = seedItems;