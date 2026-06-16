const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REVERSED"],
      default: "PENDING",
      index: true,
    },
    source: {
      type: String,
      enum: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT", "CALL", "CHAT"],
      default: "RAZORPAY",
      index: true,
    },
    description: { type: String },
    openingBalance: { type: Number },
    closingBalance: { type: Number },
    reference: {
      razorpayTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RazorpayTransaction",
      },
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

walletTransactionSchema.index(
  { "reference.razorpayPaymentId": 1 },
  { unique: true, sparse: true },
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 }, { background: true });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
