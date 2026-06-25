const mongoose = require("mongoose");

const mentorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String },
    email: { type: String, lowercase: true, trim: true },
    mobile: { type: Number },
    bio: { type: String },
    experience: { type: Number, required: true, default: 0, index: true },
    specifications: { type: [String], default: [], index: true },
    languages: { type: [String], default: [], index: true },
    mentorType: {
      type: String,
      required: true,
      enum: ["emotional", "professional"],
      index: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Mentor", mentorSchema);
