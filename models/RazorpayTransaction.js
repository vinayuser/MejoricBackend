const mongoose = require("mongoose");

const razorpayTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    amountInSmallestUnit: { type: Number, required: true },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      required: true,
      index: true,
    },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED"],
      default: "CREATED",
      index: true,
    },
    webhookVerified: { type: Boolean, default: false },
    raw: { type: mongoose.Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

// razorpayTransactionSchema.index(
//   { razorpayPaymentId: 1 },
//   { unique: true, sparse: true },
// );

module.exports = mongoose.model("RazorpayTransaction", razorpayTransactionSchema,);
