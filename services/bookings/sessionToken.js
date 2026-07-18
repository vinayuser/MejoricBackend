const mongoose = require("mongoose");
const MentorBooking = require("../../models/MentorBooking");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const {
  isAgoraConfigured,
  buildBookingChannelName,
  toAgoraUid,
  generateRtcToken,
} = require("../../helpers/agora.helper");

const JOIN_EARLY_MS = 15 * 60 * 1000;
const JOIN_GRACE_MS = 15 * 60 * 1000;

async function assertBookingAccess(booking, userId) {
  const mentorId = booking.mentorId?._id || booking.mentorId;
  const isMentor = String(mentorId) === String(userId);
  const isBooker = booking.userId && String(booking.userId) === String(userId);

  if (isMentor || isBooker) {
    return isMentor ? "mentor" : "user";
  }

  const user = await User.findById(userId).select("email");
  const emailMatch =
    user?.email &&
    booking.guestDetails?.email &&
    user.email.toLowerCase() === booking.guestDetails.email.toLowerCase();

  if (emailMatch) return "user";

  throwError(403, "You are not authorized to join this session");
}

function assertJoinWindow(booking) {
  if (!["scheduled", "in_progress"].includes(booking.status)) {
    throwError(400, "This session is no longer available to join");
  }

  const now = Date.now();
  const start = new Date(booking.scheduledAt).getTime();
  const durationMs = (booking.durationMinutes || 45) * 60 * 1000;
  const openAt = start - JOIN_EARLY_MS;
  const closeAt = start + durationMs + JOIN_GRACE_MS;

  if (now < openAt) {
    throwError(400, "Session room opens 15 minutes before the scheduled time");
  }
  if (now > closeAt) {
    throwError(400, "This session has ended");
  }
}

exports.getBookingSessionToken = async (userId, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throwError(422, "Invalid booking ID");
  }

  const booking = await MentorBooking.findById(bookingId).populate(
    "mentorId",
    "name email image",
  );

  if (!booking || booking.isDeleted) {
    throwError(404, "Booking not found");
  }

  const role = await assertBookingAccess(booking, userId);
  assertJoinWindow(booking);

  if (!isAgoraConfigured()) {
    throwError(503, "Video sessions are not configured yet. Please contact support.");
  }

  const channelName =
    booking.agoraChannelName || buildBookingChannelName(booking._id);
  const uid = toAgoraUid(userId);
  const token = generateRtcToken(channelName, uid);
  const callType = booking.sessionFormat === "audio" ? "audio" : "video";

  if (booking.status === "scheduled") {
    booking.status = "in_progress";
    await booking.save();
  }

  const mentor = booking.mentorId;

  return {
    appId: process.env.AGORA_APP_ID,
    token,
    channelName,
    uid,
    callType,
    role,
    booking: {
      id: booking._id,
      slotLabel: booking.slotLabel,
      scheduledAt: booking.scheduledAt,
      sessionFormat: booking.sessionFormat,
      durationMinutes: booking.durationMinutes,
      mentorName: mentor?.name || "Mentor",
      mentorImage: mentor?.image,
      guestName: booking.guestDetails?.fullName,
    },
  };
};
