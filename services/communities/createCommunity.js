const Community = require("../../models/Community");
const { throwError } = require("../../utils");
const { uploadImage } = require("../uploads");

const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `community-${Date.now()}`;

exports.createCommunity = async (payload, image) => {
  const {
    name,
    description = "",
    who = "",
    emoji = "💬",
    color = "#7c6ba8",
    isActive,
    avatarColors,
  } = payload;

  if (!name?.trim()) throwError(422, "Name is required");

  const existing = await Community.findOne({
    name: name.trim(),
    isDeleted: false,
  });
  if (existing) throwError(400, "Community already exists with this name");

  let imageUrl = "";
  if (image) imageUrl = await uploadImage(image.tempFilePath);

  let colors = [];
  if (avatarColors) {
    try {
      colors =
        typeof avatarColors === "string"
          ? JSON.parse(avatarColors)
          : avatarColors;
    } catch {
      colors = String(avatarColors)
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }
  if (!colors.length) colors = [color || "#7c6ba8", "#a593cc", "#5f4f86"];

  return Community.create({
    name: name.trim(),
    description: String(description).trim(),
    who: String(who).trim(),
    emoji: emoji || "💬",
    color: color || "#7c6ba8",
    image: imageUrl,
    slug: slugify(name),
    avatarColors: colors,
    isActive: typeof isActive === "undefined" ? true : isActive === true || isActive === "true",
  });
};
