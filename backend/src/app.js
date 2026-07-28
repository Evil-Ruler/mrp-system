const inventoryRoutes = require("./inventory/routes/inventory.routes");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/inventory", inventoryRoutes);



module.exports = app;