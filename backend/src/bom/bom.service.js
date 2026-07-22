const bomRepository = require("./bom.repository");

// =============================
// GET ALL BOMS
// =============================
async function getAllBoms() {
  return bomRepository.getAllBoms();
}

// =============================
// GET BOM BY ID
// =============================
async function getBomById(id) {
  return bomRepository.getBomById(id);
}

// =============================
// CREATE BOM
// =============================
async function createBom(data) {

  // Check duplicate BOM ID
  const existingBom = await bomRepository.getBomById(data.bomId);

  if (existingBom) {
    const error = new Error("BOM already exists");
    error.status = 409;
    throw error;
  }

  // Check finished good exists
  const finishedGood = await bomRepository.getItemById(data.finishedGoodId);

  if (!finishedGood) {
    const error = new Error("Finished good not found");
    error.status = 404;
    throw error;
  }

  // Check every material referenced by a line exists
  for (const line of data.lines) {
    const material = await bomRepository.getItemById(line.materialId);

    if (!material) {
      const error = new Error(
        `Material not found: item ID ${line.materialId}`
      );
      error.status = 404;
      throw error;
    }
  }

  return bomRepository.createBom(data);
}

// =============================
// UPDATE BOM
// =============================
async function updateBom(id, data) {

  // Check BOM exists
  const existingBom = await bomRepository.getBomById(id);

  if (!existingBom) {
    const error = new Error("BOM not found");
    error.status = 404;
    throw error;
  }

  // If finishedGoodId is updated, verify it exists
  if (data.finishedGoodId !== undefined) {
    const finishedGood = await bomRepository.getItemById(data.finishedGoodId);

    if (!finishedGood) {
      const error = new Error("Finished good not found");
      error.status = 404;
      throw error;
    }
  }

  // If lines are updated, verify every material exists
  if (data.lines !== undefined) {
    for (const line of data.lines) {
      const material = await bomRepository.getItemById(line.materialId);

      if (!material) {
        const error = new Error(
          `Material not found: item ID ${line.materialId}`
        );
        error.status = 404;
        throw error;
      }
    }
  }

  return bomRepository.updateBom(id, data);
}

// =============================
// DELETE BOM
// =============================
async function deleteBom(id) {

  const existingBom = await bomRepository.getBomById(id);

  if (!existingBom) {
    const error = new Error("BOM not found");
    error.status = 404;
    throw error;
  }

  return bomRepository.deleteBom(id);
}

module.exports = {
  getAllBoms,
  getBomById,
  createBom,
  updateBom,
  deleteBom,
};