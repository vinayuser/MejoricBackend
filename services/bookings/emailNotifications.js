const MentorBooking = require("../../models/MentorBooking");
const User = require("../../models/User");
const { ROLES } = require("../../constants");
const {
  sendBookingConfirmationToUser,
  sendBookingConfirmationToMentor,
  sendBookingReminderEmail,
} = require("../../helpers/nodeMailer/sendBookingEmails");

const REMINDER_TOLERANCE_MS = 90 * 1000;

function isWithinReminderWindow(scheduledAt, minutesBefore) {
  const targetMs = new Date(scheduledAt).getTime() - minutesBefore * 60 * 1000;
  const now = Date.now();
  return now >= targetMs - REMINDER_TOLERANCE_MS && now < targetMs + REMINDER_TOLERANCE_MS;
}

async function getMentorEmail(mentorId) {
  const mentor = await User.findById(mentorId).select("name email role");
  if (!mentor || mentor.role !== ROLES.MENTOR) return null;
  return mentor;
}

exports.sendBookingConfirmationEmails = async (bookingId) => {
  const booking = await MentorBooking.findById(bookingId);
  if (!booking || booking.isDeleted) return;

  const mentor = await getMentorEmail(booking.mentorId);
  if (!mentor?.email) {
    console.warn(`⚠️ Booking ${bookingId}: mentor email not found`);
    return;
  }

  const guest = booking.guestDetails;
  let userOk = booking.remindersSent?.confirmationUser;
  let mentorOk = booking.remindersSent?.confirmationMentor;

  if (!userOk && guest?.email) {
    const result = await sendBookingConfirmationToUser({
      userEmail: guest.email,
      userName: guest.fullName,
      mentorName: mentor.name,
      scheduledAt: booking.scheduledAt,
      slotLabel: booking.slotLabel,
      zoomMeetingId: booking.zoomMeetingId,
      zoomPassword: booking.zoomPassword,
      zoomJoinUrl: booking.zoomJoinUrl,
    });
    userOk = result.success || result.skipped;
    if (userOk) {
      await MentorBooking.updateOne(
        { _id: booking._id },
        { $set: { "remindersSent.confirmationUser": true } },
      );
    }
  }

  if (!mentorOk && mentor.email) {
    const result = await sendBookingConfirmationToMentor({
      mentorEmail: mentor.email,
      mentorName: mentor.name,
      guestDetails: guest,
      scheduledAt: booking.scheduledAt,
      slotLabel: booking.slotLabel,
      zoomMeetingId: booking.zoomMeetingId,
      zoomPassword: booking.zoomPassword,
      zoomStartUrl: booking.zoomStartUrl,
      zoomJoinUrl: booking.zoomJoinUrl,
    });
    mentorOk = result.success || result.skipped;
    if (mentorOk) {
      await MentorBooking.updateOne(
        { _id: booking._id },
        { $set: { "remindersSent.confirmationMentor": true } },
      );
    }
  }

  const emailStatus =
    userOk && mentorOk ? "sent" : userOk || mentorOk ? "partial" : "failed";
  await MentorBooking.updateOne({ _id: booking._id }, { $set: { emailStatus } });
};

async function sendReminderIfDue(booking, mentor, minutesBefore, fieldUser, fieldMentor) {
  if (!isWithinReminderWindow(booking.scheduledAt, minutesBefore)) return;

  const guest = booking.guestDetails;
  const updates = {};

  if (!booking.remindersSent?.[fieldUser] && guest?.email) {
    const result = await sendBookingReminderEmail({
      recipientEmail: guest.email,
      recipientName: guest.fullName,
      mentorName: mentor.name,
      guestName: guest.fullName,
      scheduledAt: booking.scheduledAt,
      slotLabel: booking.slotLabel,
      minutesBefore,
      zoomMeetingId: booking.zoomMeetingId,
      zoomPassword: booking.zoomPassword,
      zoomJoinUrl: booking.zoomJoinUrl,
      zoomStartUrl: booking.zoomStartUrl,
      forMentor: false,
    });
    if (result.success || result.skipped) {
      updates[`remindersSent.${fieldUser}`] = true;
    }
  }

  if (!booking.remindersSent?.[fieldMentor] && mentor.email) {
    const result = await sendBookingReminderEmail({
      recipientEmail: mentor.email,
      recipientName: mentor.name,
      mentorName: mentor.name,
      guestName: guest.fullName,
      scheduledAt: booking.scheduledAt,
      slotLabel: booking.slotLabel,
      minutesBefore,
      zoomMeetingId: booking.zoomMeetingId,
      zoomPassword: booking.zoomPassword,
      zoomJoinUrl: booking.zoomJoinUrl,
      zoomStartUrl: booking.zoomStartUrl,
      forMentor: true,
    });
    if (result.success || result.skipped) {
      updates[`remindersSent.${fieldMentor}`] = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    await MentorBooking.updateOne({ _id: booking._id }, { $set: updates });
  }
}

exports.processBookingReminders = async () => {
  const now = new Date();
  const horizon = new Date(now.getTime() + 35 * 60 * 1000);

  const bookings = await MentorBooking.find({
    isDeleted: false,
    status: { $in: ["scheduled", "in_progress"] },
    scheduledAt: { $gte: now, $lte: horizon },
  }).lean();

  if (bookings.length === 0) return;

  const mentorIds = [...new Set(bookings.map((b) => String(b.mentorId)))];
  const mentors = await User.find({
    _id: { $in: mentorIds },
    role: ROLES.MENTOR,
  })
    .select("name email")
    .lean();
  const mentorMap = new Map(mentors.map((m) => [String(m._id), m]));

  for (const booking of bookings) {
    const mentor = mentorMap.get(String(booking.mentorId));
    if (!mentor) continue;

    await sendReminderIfDue(booking, mentor, 30, "halfHourUser", "halfHourMentor");
    await sendReminderIfDue(booking, mentor, 5, "fiveMinUser", "fiveMinMentor");
  }
};
