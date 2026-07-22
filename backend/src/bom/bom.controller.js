const bomService = require("./bom.service");

const {
  validateBomId,
  validateCreateBom,
  validateUpdateBom,
} = require("./bom.validation");

// ======================================
// GET ALL BOMS
// ======================================
async function getAllBoms(req, res) {
  try {
    const boms = await bomService.getAllBoms();

    return res.status(200).json(boms);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// GET BOM BY ID
// ======================================
async function getBomById(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateBomId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const bom = await bomService.getBomById(id);

    if (!bom) {
      return res.status(404).json({
        message: "BOM not found.",
      });
    }

    return res.status(200).json(bom);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// CREATE BOM
// ======================================
async function createBom(req, res) {
  try {
    const validationError = validateCreateBom(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const bom = await bomService.createBom(req.body);

    return res.status(201).json(bom);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// UPDATE BOM
// ======================================
async function updateBom(req, res) {
  try {
    const { id } = req.params;

    let validationError = validateBomId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    validationError = validateUpdateBom(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const updatedBom = await bomService.updateBom(id, req.body);

    return res.status(200).json(updatedBom);

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

// ======================================
// DELETE BOM
// ======================================
async function deleteBom(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateBomId(id);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    await bomService.deleteBom(id);

    return res.status(204).send();

  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || "Internal server error.",
    });
  }
}

module.exports = {
  getAllBoms,
  getBomById,
  createBom,
  updateBom,
  deleteBom,
};