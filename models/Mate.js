const mongoose = require("mongoose");

const mateSchema = new mongoose.Schema(
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
    // categoryId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Category",
    //   required: true,
    //   index: true,
    // },
    pricePerMin: { type: Number, default: 12, index: true },
    priceUnit: {
      type: String,
      default: "RUPEE",
      enum: ["RUPEE", "USD"],
      index: true,
    },
    experience: { type: Number, required: true, index: true },
    specifications: { type: [String], default: [], index: true },
    languages: { type: [String], default: [], index: true },
    isBusy: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Mate", mateSchema);
