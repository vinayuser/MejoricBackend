const mongoose = require("mongoose");

const careerApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CareerJob",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, default: "", trim: true },
    cvUrl: { type: String, required: true },
    cvFileName: { type: String, default: "" },
    whyApplying: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "reviewed", "shortlisted", "rejected"],
      default: "pending",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

careerApplicationSchema.index({ jobId: 1, email: 1 });

module.exports = mongoose.model("CareerApplication", careerApplicationSchema);
