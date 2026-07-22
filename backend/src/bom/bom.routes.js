const express = require("express");

const {
  getAllBoms,
  getBomById,
  createBom,
  updateBom,
  deleteBom,
} = require("./bom.controller");

const router = express.Router();

router.get("/boms", getAllBoms);

router.get("/boms/:id", getBomById);

router.post("/boms", createBom);

router.put("/boms/:id", updateBom);

router.delete("/boms/:id", deleteBom);

module.exports = router;