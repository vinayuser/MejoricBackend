const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    who: { type: String, trim: true, default: "" },
    emoji: { type: String, trim: true, default: "💬" },
    color: { type: String, trim: true, default: "#9043B5" },
    image: { type: String, default: "" },
    memberCount: { type: Number, default: 0 },
    slug: { type: String, trim: true, index: true },
    avatarColors: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

communitySchema.index({ name: 1, isDeleted: 1 });

module.exports = mongoose.model("Community", communitySchema);
