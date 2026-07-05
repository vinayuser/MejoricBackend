const mongoose = require("mongoose");

const COLLECTION_NAME = "mateactivitylogs";
const CAPPED_MAX = 500;
const CAPPED_SIZE_BYTES = 512 * 1024;

const mateActivityLogSchema = new mongoose.Schema(
  {
    mateUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mateName: { type: String, default: "" },
    mobile: { type: Number },
    activity: {
      type: String,
      enum: ["online", "offline"],
      required: true,
    },
    at: { type: Date, required: true, default: Date.now },
    dayKey: { type: String, required: true },
    source: { type: String, default: "mate_app" },
    durationSeconds: { type: Number, default: null },
  },
  { versionKey: false },
);

module.exports = {
  COLLECTION_NAME,
  CAPPED_MAX,
  CAPPED_SIZE_BYTES,
  MateActivityLog: mongoose.model(COLLECTION_NAME, mateActivityLogSchema, COLLECTION_NAME),
};
