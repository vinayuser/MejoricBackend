const Community = require("../../models/Community");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");
const { getCommunityById } = require("./getCommunityById");

exports.updateCommunityById = async (id, payload, image) => {
  await getCommunityById(id);

  const updates = {};
  if (typeof payload.name !== "undefined") updates.name = String(payload.name).trim();
  if (typeof payload.description !== "undefined")
    updates.description = String(payload.description).trim();
  if (typeof payload.who !== "undefined") updates.who = String(payload.who).trim();
  if (typeof payload.emoji !== "undefined") updates.emoji = payload.emoji;
  if (typeof payload.color !== "undefined") updates.color = payload.color;
  if (typeof payload.isActive !== "undefined") {
    updates.isActive =
      payload.isActive === true || payload.isActive === "true";
  }
  if (typeof payload.avatarColors !== "undefined") {
    let colors = payload.avatarColors;
    if (typeof colors === "string") {
      try {
        colors = JSON.parse(colors);
      } catch {
        colors = colors.split(",").map((c) => c.trim()).filter(Boolean);
      }
    }
    updates.avatarColors = colors;
  }
  if (image) updates.image = await uploadImage(image.tempFilePath);

  if (updates.name) {
    const clash = await Community.findOne({
      name: updates.name,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (clash) throwError(400, "Community already exists with this name");
  }

  const updated = await Community.findByIdAndUpdate(id, updates, {
    new: true,
  });
  return updated;
};
