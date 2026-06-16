const PrenatalCare = require("../../models/PrenatalCare");
const { throwError, validateObjectId } = require("../../utils");
const { deleteImage } = require("../uploads");

exports.deletePrenatalCare = async (id) => {
  validateObjectId(id, "PrenatalCare Id");
  const result = await PrenatalCare.findById(id);
  if (!result || result.isDeleted) throwError(404, "Prenatal care not found");
  await deleteImage(result?.image);
  result.isDeleted = true;
  result.isActive = false;
  result.image = null;
  result.updatedAt = new Date();
  await result.save();
  return;
};
