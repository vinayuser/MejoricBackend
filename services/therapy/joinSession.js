const mongoose = require("mongoose");
const TherapyCohort = require("../../models/TherapyCohort");
const TherapyEnrollment = require("../../models/TherapyEnrollment");
const { throwError } = require("../../utils");
const {
  isAgoraConfigured,
  toAgoraUid,
  generateRtcToken,
} = require("../../helpers/agora.helper");

const JOIN_EARLY_MS = 15 * 60 * 1000;
const JOIN_GRACE_MS = 15 * 60 * 1000;

/**
 * Platform-only join: requires login + paid enrollment.
 * Returns meeting URL and/or Agora credentials — never to non-enrollees.
 */
exports.getTherapySessionJoin = async (userId, enrollmentId, slotId) => {
  if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
    throwError(422, "Invalid enrollment");
  }

  const enrollment = await TherapyEnrollment.findOne({
    _id: enrollmentId,
    userId,
    isDeleted: false,
    status: "enrolled",
  });
  if (!enrollment) {
    throwError(
      403,
      "You have not purchased this group therapy cohort. Enroll from Mejoric to join.",
    );
  }

  const cohort = await TherapyCohort.findOne({
    _id: enrollment.cohortId,
    isDeleted: false,
  });
  if (!cohort) throwError(404, "Cohort not found");

  let slot = null;
  if (slotId) {
    slot = cohort.slots.id(slotId);
    if (!slot) throwError(404, "Session slot not found");
  } else {
    // Nearest upcoming / live slot
    const now = Date.now();
    const sorted = [...(cohort.slots || [])].sort(
      (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt),
    );
    slot =
      sorted.find((s) => {
        const start = new Date(s.scheduledAt).getTime();
        const end =
          start +
          (s.durationMinutes || cohort.durationMinutes || 90) * 60 * 1000 +
          JOIN_GRACE_MS;
        return now <= end;
      }) || sorted[sorted.length - 1];
  }

  if (!slot) throwError(404, "No sessions scheduled for this cohort");

  const now = Date.now();
  const start = new Date(slot.scheduledAt).getTime();
  const durationMs =
    (slot.durationMinutes || cohort.durationMinutes || 90) * 60 * 1000;
  const openAt = start - JOIN_EARLY_MS;
  const closeAt = start + durationMs + JOIN_GRACE_MS;

  if (now < openAt) {
    throwError(
      400,
      "Session opens 15 minutes before the scheduled time. Join from Mejoric while logged in.",
    );
  }
  if (now > closeAt) {
    throwError(400, "This session has ended");
  }

  // Capacity for the live room: cannot exceed cohort seat limit
  // (enrolled count already capped; this reinforces meeting access)
  if (cohort.takenSeats > cohort.totalSeats) {
    throwError(403, "Cohort capacity exceeded");
  }

  if (!slot.agoraChannelName) {
    slot.agoraChannelName = `therapy_${cohort._id}_${slot._id}`;
    await cohort.save();
  }

  const result = {
    enrollmentId: String(enrollment._id),
    cohortId: String(cohort._id),
    theme: cohort.theme,
    slot: {
      id: String(slot._id),
      label: slot.label,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes || cohort.durationMinutes,
    },
    meetingUrl: slot.meetingUrl || null,
    meetingPassword: slot.meetingPassword || null,
    agora: null,
  };

  if (isAgoraConfigured()) {
    const uid = toAgoraUid(userId);
    const token = generateRtcToken(slot.agoraChannelName, uid);
    result.agora = {
      appId: process.env.AGORA_APP_ID,
      token,
      channelName: slot.agoraChannelName,
      uid,
      callType: "video",
    };
  } else if (!slot.meetingUrl) {
    throwError(
      503,
      "Meeting is not configured yet. Please contact support or check your email for updates.",
    );
  }

  if (slot.status === "scheduled") {
    slot.status = "live";
    await cohort.save();
  }

  return result;
};
