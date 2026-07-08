const express = require("express");
const cors = require("cors");

const salesRoutes = require("./sales");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("MRP Backend Running");
});

// Mount Sales routes
app.use("/api", salesRoutes);

module.exports = app;