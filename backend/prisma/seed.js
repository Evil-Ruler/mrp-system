require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const seedCustomers = require("./seeds/customer.seed");
const seedSuppliers = require("./seeds/supplier.seed");
const seedItems = require("./seeds/item.seed");
const seedSalesOrders = require("./seeds/salesOrder.seed");
const seedPurchaseOrders = require("./seeds/purchaseOrder.seed");
const seedProductionOrders = require("./seeds/productionOrder.seed");
const seedBOMHeaders = require("./seeds/bomHeader.seed");
const seedSalesOrderLines = require("./seeds/salesOrderLine.seed");
const seedPurchaseOrderLines = require("./seeds/purchaseOrderLine.seed");
const seedBOMLines = require("./seeds/bomLine.seed");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

async function main() {

    try {

        console.log("🚀 Starting Database Seeding...\n");

        await seedCustomers(prisma);
        await seedSuppliers(prisma);
        await seedItems(prisma);
        await seedSalesOrders(prisma);
        await seedPurchaseOrders(prisma);
        await seedProductionOrders(prisma);
        await seedBOMHeaders(prisma);
        await seedSalesOrderLines(prisma);
        await seedPurchaseOrderLines(prisma);
        await seedBOMLines(prisma);

        console.log("\n🎉 Database Seeded Successfully.");

    } catch (error) {

        console.error(error);

    } finally {

        await prisma.$disconnect();
        await pool.end();

    }

}

main();