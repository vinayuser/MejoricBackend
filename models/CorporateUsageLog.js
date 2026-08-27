const mongoose = require("mongoose");

const corporateUsageLogSchema = new mongoose.Schema(
  {
    corporateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Corporate",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    usageType: {
      type: String,
      enum: ["audio", "video", "chat"],
      required: true,
      index: true,
    },
    minutesUsed: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: ["call", "chat", "admin_adjustment"],
      default: "call",
    },
    referenceId: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false },
);

corporateUsageLogSchema.index({ corporateId: 1, createdAt: -1 });

module.exports = mongoose.model("CorporateUsageLog", corporateUsageLogSchema);
