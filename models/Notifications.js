const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: String,
    message: String,
    type: {
      type: String,
      enum: ["CALL", "CHAT", "CHAT_INITIATED", "CHAT_MESSAGE", "CHAT_ACCEPTED", "CHAT_REJECTED", "CHAT_ENDED", "OTHER"],
      default: "OTHER",
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CallSession",
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Notification", notificationSchema);
