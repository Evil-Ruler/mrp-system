const express = require("express");
const router = express.Router();
const mrpRoutes = require("./mrp.routes");

/**
 * Root router module for MRP sub-system.
 * Mounts all sub-routes for registration in express app.use("/api/mrp", router).
 */
router.use("/", mrpRoutes);

module.exports = router;
