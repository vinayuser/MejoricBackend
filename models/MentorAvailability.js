const mongoose = require("mongoose");

const mentorAvailabilitySchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    slotIds: {
      type: [String],
      default: [],
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

mentorAvailabilitySchema.index(
  { mentorId: 1, dateKey: 1 },
  { unique: true, background: true },
);

module.exports = mongoose.model("MentorAvailability", mentorAvailabilitySchema);
