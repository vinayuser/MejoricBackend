const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ENDED", "REJECTED"],
      default: "ACTIVE",
    },
    conversationId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    totalAmountDeducted: {
      type: Number,
      default: 0,
    },
    pricePerMin: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

chatSessionSchema.index(
  { conversationId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" }, background: true }
);

chatSessionSchema.index({ senderId: 1, recipientId: 1, status: 1 }, { background: true });

module.exports = mongoose.model("ChatSession", chatSessionSchema);
