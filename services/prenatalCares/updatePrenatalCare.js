const PrenatalCare = require("../../models/PrenatalCare");
const { throwError, validateObjectId } = require("../../utils");
const { uploadImage, deleteImage } = require("../uploads");

exports.updatePrenatalCare = async (id, payload = 0, image) => {
  validateObjectId(id, "PrenatalCare Id");
  const result = await PrenatalCare.findById(id);
  if (!result || result.isDeleted) {
    throwError(404, "Prenatal care not found");
  }
  if (payload) {
    let { name, description, isActive } = payload;
    if (typeof isActive !== "undefined") result.isActive = !result.isActive;
    if (name) {
      name = name.toLowerCase();
      const existing = await PrenatalCare.findOne({
        _id: { $ne: id },
        name,
        isDeleted: false,
      });
      if (existing) {
        throwError(400, "Another prenatal care exists with this name");
      }
      result.name = name;
    }
    if (description) result.description = description?.toLowerCase();
  }
  if (image) {
    if (result.image) await deleteImage(result.image);
    const imageUrl = await uploadImage(image.tempFilePath);
    result.image = imageUrl;
  }
  result.updatedAt = new Date();
  await result.save();
  return result;
};
