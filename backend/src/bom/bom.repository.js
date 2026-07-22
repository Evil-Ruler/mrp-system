const prisma = require("../lib/prisma");

const bomInclude = {
  finishedGood: true,
  bomLines: {
    include: {
      material: true,
    },
  },
};

// =============================
// GET ALL BOMS
// =============================
async function getAllBoms() {
  return prisma.bOMHeader.findMany();
}

// =============================
// GET BOM BY ID
// =============================
async function getBomById(id) {
  return prisma.bOMHeader.findUnique({
    where: {
      bomId: id,
    },
    include: bomInclude,
  });
}

// =============================
// GET ITEM BY ID
// Used to verify finished goods / materials exist
// =============================
async function getItemById(itemId) {
  return prisma.item.findUnique({
    where: {
      itemId,
    },
  });
}

// =============================
// Get next BOM Line ID
// bomLineId has no DB default, so V1 assigns it
// as max(bomLineId) + 1 inside the calling transaction.
// =============================
async function getNextBomLineId(tx) {
  const lastLine = await tx.bOMLine.findFirst({
    orderBy: {
      bomLineId: "desc",
    },
    select: {
      bomLineId: true,
    },
  });

  return lastLine ? lastLine.bomLineId + 1 : 1;
}

// =============================
// CREATE BOM
// Creates the header and all lines in one transaction
// so a failure on any line rolls back the whole BOM.
// =============================
async function createBom(data) {
  return prisma.$transaction(async (tx) => {
    const bom = await tx.bOMHeader.create({
      data: {
        bomId: data.bomId,
        finishedGoodId: data.finishedGoodId,
      },
    });

    let nextLineId = await getNextBomLineId(tx);

    for (const line of data.lines) {
      await tx.bOMLine.create({
        data: {
          bomLineId: nextLineId,
          bomId: bom.bomId,
          materialId: line.materialId,
          quantityRequired: line.quantityRequired,
        },
      });

      nextLineId++;
    }

    return tx.bOMHeader.findUnique({
      where: {
        bomId: bom.bomId,
      },
      include: bomInclude,
    });
  });
}

// =============================
// UPDATE BOM
// V1 approach: header fields update in place.
// If lines are provided, existing lines are replaced
// wholesale (delete + recreate) inside a transaction.
// =============================
async function updateBom(id, data) {
  return prisma.$transaction(async (tx) => {
    if (data.finishedGoodId !== undefined) {
      await tx.bOMHeader.update({
        where: {
          bomId: id,
        },
        data: {
          finishedGoodId: data.finishedGoodId,
        },
      });
    }

    if (data.lines !== undefined) {
      await tx.bOMLine.deleteMany({
        where: {
          bomId: id,
        },
      });

      let nextLineId = await getNextBomLineId(tx);

      for (const line of data.lines) {
        await tx.bOMLine.create({
          data: {
            bomLineId: nextLineId,
            bomId: id,
            materialId: line.materialId,
            quantityRequired: line.quantityRequired,
          },
        });

        nextLineId++;
      }
    }

    return tx.bOMHeader.findUnique({
      where: {
        bomId: id,
      },
      include: bomInclude,
    });
  });
}

// =============================
// DELETE BOM
// Lines must be removed first — the schema has no
// cascade delete, so the FK would otherwise block it.
// =============================
async function deleteBom(id) {
  return prisma.$transaction(async (tx) => {
    await tx.bOMLine.deleteMany({
      where: {
        bomId: id,
      },
    });

    return tx.bOMHeader.delete({
      where: {
        bomId: id,
      },
    });
  });
}

module.exports = {
  getAllBoms,
  getBomById,
  getItemById,
  createBom,
  updateBom,
  deleteBom,
};