const express = require("express");
const cors = require("cors");

const salesRoutes = require("./sales");
const bomRoutes = require("./bom");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("MRP Backend Running");
});

app.use("/api", salesRoutes);
app.use("/api", bomRoutes);

module.exports = app;