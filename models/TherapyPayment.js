const mongoose = require("mongoose");

/** Pending Razorpay orders for therapy enrollment (mirrors MentorBookingPayment). */
const therapyPaymentSchema = new mongoose.Schema(
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
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "paid", "expired", "failed"],
      default: "pending",
      index: true,
    },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    expiresAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("TherapyPayment", therapyPaymentSchema);
