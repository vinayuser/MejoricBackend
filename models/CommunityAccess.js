const mongoose = require("mongoose");

const communityAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    unlockedAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["WALLET", "RAZORPAY"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

communityAccessSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, sparse: true },
);

module.exports = mongoose.model("CommunityAccess", communityAccessSchema);
