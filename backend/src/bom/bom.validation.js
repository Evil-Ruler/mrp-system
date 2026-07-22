// src/bom/bom.validation.js

// =============================
// Validate BOM ID
// Used by GET BY ID, PUT, DELETE
// =============================
function validateBomId(id) {
  if (!id) {
    return "BOM ID is required.";
  }

  if (typeof id !== "string") {
    return "BOM ID must be a string.";
  }

  if (id.trim() === "") {
    return "BOM ID cannot be empty.";
  }

  return null;
}

// =============================
// Validate a single BOM line
// Shared by create and update
// =============================
function validateBomLine(line, index) {
  if (!line || typeof line !== "object") {
    return `Line ${index + 1} must be an object.`;
  }

  const { materialId, quantityRequired } = line;

  if (materialId === undefined || materialId === null) {
    return `Line ${index + 1}: material ID is required.`;
  }

  if (!Number.isInteger(materialId)) {
    return `Line ${index + 1}: material ID must be an integer.`;
  }

  if (quantityRequired === undefined || quantityRequired === null) {
    return `Line ${index + 1}: quantity required is required.`;
  }

  if (typeof quantityRequired !== "number" || isNaN(quantityRequired)) {
    return `Line ${index + 1}: quantity required must be a number.`;
  }

  if (quantityRequired <= 0) {
    return `Line ${index + 1}: quantity required must be greater than 0.`;
  }

  return null;
}

// =============================
// Validate BOM lines array
// Checks shape + duplicate materials
// =============================
function validateBomLines(lines) {
  if (!Array.isArray(lines)) {
    return "Lines must be an array.";
  }

  if (lines.length === 0) {
    return "At least one BOM line is required.";
  }

  for (let i = 0; i < lines.length; i++) {
    const lineError = validateBomLine(lines[i], i);

    if (lineError) {
      return lineError;
    }
  }

  const materialIds = lines.map((line) => line.materialId);
  const uniqueMaterialIds = new Set(materialIds);

  if (uniqueMaterialIds.size !== materialIds.length) {
    return "Duplicate material found in BOM lines. Each material may appear only once per BOM.";
  }

  return null;
}

// =============================
// Validate POST Request
// =============================
function validateCreateBom(body) {
  if (!body) {
    return "Request body is required.";
  }

  const { bomId, finishedGoodId, lines } = body;

  // BOM ID
  if (!bomId) {
    return "BOM ID is required.";
  }

  if (typeof bomId !== "string") {
    return "BOM ID must be a string.";
  }

  if (bomId.trim() === "") {
    return "BOM ID cannot be empty.";
  }

  // Finished Good ID
  if (finishedGoodId === undefined || finishedGoodId === null) {
    return "Finished Good ID is required.";
  }

  if (!Number.isInteger(finishedGoodId)) {
    return "Finished Good ID must be an integer.";
  }

  // Lines
  const linesError = validateBomLines(lines);

  if (linesError) {
    return linesError;
  }

  return null;
}

// =============================
// Validate PUT Request
// Only validate fields that exist
// =============================
function validateUpdateBom(body) {
  if (!body) {
    return "Request body is required.";
  }

  const { finishedGoodId, lines } = body;

  if (finishedGoodId === undefined && lines === undefined) {
    return "Nothing to update. Provide finishedGoodId and/or lines.";
  }

  if (finishedGoodId !== undefined) {
    if (!Number.isInteger(finishedGoodId)) {
      return "Finished Good ID must be an integer.";
    }
  }

  if (lines !== undefined) {
    const linesError = validateBomLines(lines);

    if (linesError) {
      return linesError;
    }
  }

  return null;
}

module.exports = {
  validateBomId,
  validateCreateBom,
  validateUpdateBom,
};