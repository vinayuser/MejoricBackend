const PrenatalCare = require("../../models/PrenatalCare");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");

exports.createPrenatalCare = async (payload, image) => {
  let { name, description, isActive } = payload;
  name = name?.toLowerCase();
  description = description?.toLowerCase();
  const existing = await PrenatalCare.findOne({ name, isDeleted: false });
  if (existing) throwError(400, "Prenatal care already exist with this name");
  let imageUrl;
  if (image) imageUrl = await uploadImage(image.tempFilePath);
  return await PrenatalCare.create({
    name,
    description,
    image: imageUrl,
    isActive,
  });
};
