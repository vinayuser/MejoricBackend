const mongoose = require("mongoose");

const therapyEnrollmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TherapyCohort",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["enrolled", "waitlisted", "cancelled"],
      default: "enrolled",
      index: true,
    },
    amountPaid: { type: Number, required: true },
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "WALLET", "ADMIN"],
      required: true,
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

therapyEnrollmentSchema.index(
  { userId: 1, cohortId: 1 },
  { unique: true },
);

module.exports = mongoose.model("TherapyEnrollment", therapyEnrollmentSchema);
