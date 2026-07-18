const mongoose = require("mongoose");

const therapySlotSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 90 },
    /** Optional Zoom/Meet URL — only returned after purchase + login gate */
    meetingUrl: { type: String, trim: true, default: "" },
    meetingPassword: { type: String, trim: true, default: "" },
    agoraChannelName: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  { _id: true },
);

const therapyCohortSchema = new mongoose.Schema(
  {
    theme: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, default: "" },
    band: { type: String, trim: true, default: "#7c6ba8" },
    description: { type: String, trim: true, default: "" },
    who: { type: String, trim: true, default: "" },
    approach: { type: String, trim: true, default: "" },
    psychologistLabel: { type: String, trim: true, default: "" },
    sessionsCount: { type: Number, default: 6 },
    durationMinutes: { type: Number, default: 90 },
    dayLabel: { type: String, trim: true, default: "" },
    /** Full cohort price (INR) — admin managed */
    price: { type: Number, required: true, min: 1 },
    totalSeats: { type: Number, required: true, min: 1, default: 8 },
    takenSeats: { type: Number, default: 0, min: 0 },
    waitlistEnabled: { type: Boolean, default: true },
    slots: { type: [therapySlotSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "open", "full", "closed"],
      default: "open",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

therapyCohortSchema.virtual("seatsLeft").get(function seatsLeft() {
  return Math.max(0, (this.totalSeats || 0) - (this.takenSeats || 0));
});

therapyCohortSchema.set("toJSON", { virtuals: true });
therapyCohortSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("TherapyCohort", therapyCohortSchema);
