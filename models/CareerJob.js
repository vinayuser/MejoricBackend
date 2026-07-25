const mongoose = require("mongoose");

const careerJobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true },
    description: { type: String, default: "" },
    skills: { type: [String], default: [] },
    location: { type: String, default: "", trim: true },
    isRemote: { type: Boolean, default: true, index: true },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      default: "full-time",
    },
    experience: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    salaryRange: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

careerJobSchema.index({ title: "text", department: "text", location: "text" });

module.exports = mongoose.model("CareerJob", careerJobSchema);
