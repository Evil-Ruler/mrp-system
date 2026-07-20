const express = require("express");
const cors = require("cors");

const salesRoutes = require("./sales");
const mrpRoutes = require("./mrp/routes");

const app = express();

app.use(cors());
app.use(express.json());

// Mount MRP routes under /api/mrp
app.use("/api/mrp", mrpRoutes);

app.get("/", (req, res) => {
  res.send("MRP Backend Running");
});

// Mount Sales routes
app.use("/api", salesRoutes);

module.exports = app;