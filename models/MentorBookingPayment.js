const mongoose = require("mongoose");

const guestDetailsSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    gender: { type: String },
    age: { type: String },
    budget: { type: String },
    referral: { type: String },
    supportNeeds: { type: String, default: "" },
  },
  { _id: false },
);

const mentorBookingPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true },
    slotLabel: { type: String, required: true },
    dateKey: { type: String, required: true, index: true },
    slotId: { type: String, required: true },
    sessionFormat: {
      type: String,
      enum: ["audio", "video", "video60"],
      default: "video",
    },
    sessionPrice: { type: Number, required: true },
    durationMinutes: { type: Number, default: 45 },
    guestDetails: { type: guestDetailsSchema, required: true },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, index: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "expired"],
      default: "pending",
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MentorBooking",
      index: true,
    },
    expiresAt: { type: Date, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("MentorBookingPayment", mentorBookingPaymentSchema);
