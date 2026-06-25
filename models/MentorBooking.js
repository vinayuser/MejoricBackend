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

const mentorBookingSchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    guestDetails: { type: guestDetailsSchema, required: true },
    scheduledAt: { type: Date, required: true, index: true },
    slotLabel: { type: String, required: true },
    dateKey: { type: String, required: true, index: true },
    slotId: { type: String, required: true },
    durationMinutes: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled", "no_show"],
      default: "scheduled",
      index: true,
    },
    zoomProvider: {
      type: String,
      enum: ["zoom", "mock"],
      default: "mock",
    },
    zoomMeetingId: { type: String, index: true },
    zoomMeetingUuid: { type: String },
    zoomJoinUrl: { type: String },
    zoomStartUrl: { type: String },
    zoomPassword: { type: String },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    actualDurationSeconds: { type: Number },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "partial"],
      default: "pending",
    },
    remindersSent: {
      confirmationUser: { type: Boolean, default: false },
      confirmationMentor: { type: Boolean, default: false },
      halfHourUser: { type: Boolean, default: false },
      halfHourMentor: { type: Boolean, default: false },
      fiveMinUser: { type: Boolean, default: false },
      fiveMinMentor: { type: Boolean, default: false },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

mentorBookingSchema.index(
  { mentorId: 1, slotId: 1, status: 1 },
  { background: true },
);

module.exports = mongoose.model("MentorBooking", mentorBookingSchema);
