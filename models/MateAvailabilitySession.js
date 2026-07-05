const mongoose = require("mongoose");

const mateAvailabilitySessionSchema = new mongoose.Schema(
  {
    mateUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    /** YYYY-MM-DD in Asia/Kolkata for daily rollups */
    dayKey: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["mate_app", "admin_panel", "logout", "system", "tab_close"],
      default: "mate_app",
    },
  },
  { timestamps: true, versionKey: false },
);

mateAvailabilitySessionSchema.index({ mateUserId: 1, endedAt: 1 });
mateAvailabilitySessionSchema.index({ mateUserId: 1, dayKey: 1 });

module.exports = mongoose.model(
  "MateAvailabilitySession",
  mateAvailabilitySessionSchema,
);
