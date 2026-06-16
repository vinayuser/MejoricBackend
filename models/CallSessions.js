const mongoose = require("mongoose");

const callSessionSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    callType: {
      type: String,
      enum: ["AUDIO", "VIDEO"],
      required: true,
    },
    callStatus: {
      type: String,
      enum: [
        "INITIATED",
        "RINGING",
        "ACCEPTED",
        "REJECTED",
        "MISSED",
        "ONGOING",
        "ENDED",
        "FAILED",
      ],
      default: "INITIATED",
    },
    roomId: String,
    tokenCaller: String,
    tokenReceiver: String,
    startTime: Date,
    endTime: Date,
    duration: Number, // seconds
    callChargePerMin: Number,
    totalAmountDeducted: Number,
    isMissed: { type: Boolean, default: false },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

callSessionSchema.index({ callerId: 1, receiverId: 1, callStatus: 1 }, { background: true });

module.exports = mongoose.model("CallSession", callSessionSchema);
