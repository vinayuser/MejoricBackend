const mongoose = require("mongoose");

const blockedIpSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, trim: true, index: true },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    targetUserName: { type: String, trim: true },
    targetUserRole: { type: String, trim: true },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedByName: { type: String, trim: true },
    source: {
      type: String,
      enum: ["mate_chat", "mate_call", "admin"],
      default: "mate_chat",
    },
    reason: { type: String, trim: true, default: "" },
    cfRuleId: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

blockedIpSchema.index(
  { ip: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

module.exports = mongoose.model("BlockedIp", blockedIpSchema);
