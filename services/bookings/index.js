const MentorBooking = require("../../models/MentorBooking");
const MentorAvailability = require("../../models/MentorAvailability");
const User = require("../../models/User");
const { ROLES } = require("../../constants");
const { throwError } = require("../../utils");
const { createZoomMeeting } = require("../../helpers/zoom");
const {
  buildAllSlotsForDate,
  slotIdToDate,
  toDateKey,
} = require("../../helpers/bookingSlots");
const {
  sendBookingConfirmationEmails,
} = require("./emailNotifications");

async function assertMentorUser(mentorId) {
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    throwError(404, "Mentor not found");
  }
  return mentor;
}

exports.createBooking = async ({
  mentorId,
  scheduledAt,
  slotLabel,
  dateKey,
  slotId,
  guestDetails,
  userId,
}) => {
  const mentor = await assertMentorUser(mentorId);

  const availability = await MentorAvailability.findOne({
    mentorId,
    dateKey,
    isDeleted: false,
  });

  if (!availability || !availability.slotIds.includes(slotId)) {
    throwError(422, "Selected slot is not available");
  }

  const startTime = new Date(scheduledAt);
  if (Number.isNaN(startTime.getTime()) || startTime <= new Date()) {
    throwError(422, "Please select a future time slot");
  }

  const existing = await MentorBooking.findOne({
    mentorId,
    slotId,
    isDeleted: false,
    status: { $nin: ["cancelled", "no_show"] },
  });

  if (existing) {
    throwError(409, "This time slot is no longer available");
  }

  const topic = `Mejoric session with ${guestDetails.fullName}`;
  const zoomMeeting = await createZoomMeeting({
    topic,
    startTime,
    durationMinutes: 30,
  });

  const booking = await MentorBooking.create({
    mentorId,
    userId: userId || undefined,
    guestDetails,
    scheduledAt: startTime,
    slotLabel,
    dateKey,
    slotId,
    durationMinutes: 30,
    status: "scheduled",
    zoomProvider: zoomMeeting.provider,
    zoomMeetingId: zoomMeeting.meetingId,
    zoomMeetingUuid: zoomMeeting.meetingUuid,
    zoomJoinUrl: zoomMeeting.joinUrl,
    zoomStartUrl: zoomMeeting.startUrl,
    zoomPassword: zoomMeeting.password,
  });

  await booking.populate("mentorId", "name email image");

  setImmediate(() => {
    sendBookingConfirmationEmails(booking._id).catch((error) => {
      console.error(`❌ Failed to send booking confirmation emails for ${booking._id}:`, error);
    });
  });

  return formatBookingResponse(booking, mentor);
};

exports.getBookedSlotIds = async (mentorId, dateKey) => {
  const bookings = await MentorBooking.find({
    mentorId,
    dateKey,
    isDeleted: false,
    status: { $nin: ["cancelled", "no_show"] },
  }).select("slotId");

  return bookings.map((booking) => booking.slotId);
};

exports.getPublicAvailableSlots = async (mentorId, dateKey) => {
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return [];
  }

  const availability = await MentorAvailability.findOne({
    mentorId,
    dateKey,
    isDeleted: false,
  });

  if (!availability || availability.slotIds.length === 0) {
    return [];
  }

  const bookedSlotIds = await exports.getBookedSlotIds(mentorId, dateKey);
  const now = new Date();

  return buildAllSlotsForDate(dateKey)
    .filter((slot) => availability.slotIds.includes(slot.id))
    .filter((slot) => !bookedSlotIds.includes(slot.id))
    .filter((slot) => new Date(slot.startsAt) > now);
};

exports.getPublicAvailableDates = async (mentorId, year, month) => {
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return [];
  }

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const todayKey = toDateKey(new Date());

  const records = await MentorAvailability.find({
    mentorId,
    isDeleted: false,
    dateKey: { $regex: `^${monthPrefix}` },
    slotIds: { $exists: true, $not: { $size: 0 } },
  }).select("dateKey slotIds");

  const dates = [];

  for (const record of records) {
    if (record.dateKey < todayKey) continue;
    const slots = await exports.getPublicAvailableSlots(mentorId, record.dateKey);
    if (slots.length > 0) {
      dates.push(record.dateKey);
    }
  }

  return dates.sort();
};

exports.getMentorAvailability = async (mentorId, dateKey) => {
  await assertMentorUser(mentorId);

  const availability = await MentorAvailability.findOne({
    mentorId,
    dateKey,
    isDeleted: false,
  });

  const bookedSlotIds = await exports.getBookedSlotIds(mentorId, dateKey);
  const allSlots = buildAllSlotsForDate(dateKey);

  return {
    dateKey,
    selectedSlotIds: availability?.slotIds || [],
    bookedSlotIds,
    allSlots: allSlots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      startsAt: slot.startsAt,
      isBooked: bookedSlotIds.includes(slot.id),
    })),
  };
};

exports.saveMentorAvailability = async (mentorId, dateKey, slotIds) => {
  await assertMentorUser(mentorId);

  const { parseDateKey } = require("../../helpers/bookingSlots");
  const date = parseDateKey(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    throwError(422, "You can only set availability for future dates");
  }

  const validIds = new Set(buildAllSlotsForDate(dateKey).map((slot) => slot.id));
  const cleanedSlotIds = [...new Set(slotIds.filter((id) => validIds.has(id)))];

  const bookedSlotIds = await exports.getBookedSlotIds(mentorId, dateKey);
  const finalSlotIds = [...new Set([...cleanedSlotIds, ...bookedSlotIds])];

  const availability = await MentorAvailability.findOneAndUpdate(
    { mentorId, dateKey },
    {
      mentorId,
      dateKey,
      slotIds: finalSlotIds,
      isDeleted: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    dateKey,
    selectedSlotIds: availability.slotIds,
    bookedSlotIds,
  };
};

exports.getUserBookings = async (userId, { tab = "upcoming", page = 1, limit = 20 }) => {
  const user = await User.findById(userId).select("email");
  if (!user) {
    throwError(404, "User not found");
  }

  const identityOr = [{ userId }];
  if (user.email) {
    identityOr.push({ "guestDetails.email": user.email.toLowerCase() });
  }

  const skip = (page - 1) * limit;
  const now = new Date();
  let filter = {
    isDeleted: false,
    $or: identityOr,
  };

  if (tab === "upcoming") {
    filter.status = { $in: ["scheduled", "in_progress"] };
    filter.scheduledAt = { $gte: now };
  } else {
    filter = {
      isDeleted: false,
      $and: [
        { $or: identityOr },
        {
          $or: [
            { status: { $in: ["completed", "cancelled", "no_show"] } },
            {
              scheduledAt: { $lt: now },
              status: { $nin: ["cancelled", "no_show"] },
            },
          ],
        },
      ],
    };
  }

  const [total, bookings] = await Promise.all([
    MentorBooking.countDocuments(filter),
    MentorBooking.find(filter)
      .populate("mentorId", "name email image")
      .sort({ scheduledAt: tab === "upcoming" ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    total,
    totalPages: Math.ceil(total / limit) || 1,
    page,
    limit,
    data: bookings.map(formatUserBooking),
  };
};

exports.getMentorAppointments = async (mentorId, { tab = "upcoming", page = 1, limit = 20 }) => {
  await assertMentorUser(mentorId);

  const skip = (page - 1) * limit;
  const now = new Date();
  const filter = { mentorId, isDeleted: false };

  if (tab === "upcoming") {
    filter.status = { $in: ["scheduled", "in_progress"] };
    filter.scheduledAt = { $gte: now };
  } else if (tab === "completed") {
    filter.status = { $in: ["completed", "cancelled", "no_show"] };
  } else if (tab === "past") {
    filter.$or = [
      { status: { $in: ["completed", "cancelled", "no_show"] } },
      { scheduledAt: { $lt: now }, status: { $nin: ["cancelled", "no_show"] } },
    ];
  }

  const [total, bookings] = await Promise.all([
    MentorBooking.countDocuments(filter),
    MentorBooking.find(filter)
      .sort({ scheduledAt: tab === "upcoming" ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    total,
    totalPages: Math.ceil(total / limit) || 1,
    page,
    limit,
    data: bookings.map(formatMentorAppointment),
  };
};

exports.getAdminBookings = async (query) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const filter = { isDeleted: false };
  if (query.status) filter.status = query.status;
  if (query.mentorId) filter.mentorId = query.mentorId;
  if (query.search) {
    filter.$or = [
      { "guestDetails.fullName": { $regex: query.search, $options: "i" } },
      { "guestDetails.email": { $regex: query.search, $options: "i" } },
      { "guestDetails.phone": { $regex: query.search, $options: "i" } },
    ];
  }

  const [total, bookings] = await Promise.all([
    MentorBooking.countDocuments(filter),
    MentorBooking.find(filter)
      .populate("mentorId", "name email image")
      .populate("userId", "name email mobile")
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  const stats = await MentorBooking.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalCompleted: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        totalScheduled: {
          $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] },
        },
        totalInProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
        },
        totalDurationSeconds: {
          $sum: { $ifNull: ["$actualDurationSeconds", 0] },
        },
      },
    },
  ]);

  return {
    total,
    totalPages: Math.ceil(total / limit) || 1,
    page,
    limit,
    stats: stats[0] || {
      totalCompleted: 0,
      totalScheduled: 0,
      totalInProgress: 0,
      totalDurationSeconds: 0,
    },
    data: bookings.map(formatAdminBooking),
  };
};

exports.handleZoomWebhookEvent = async (event, payload) => {
  const meetingId = payload?.object?.id || payload?.object?.uuid;
  if (!meetingId) return null;

  const booking = await MentorBooking.findOne({
    $or: [
      { zoomMeetingId: String(meetingId) },
      { zoomMeetingUuid: String(meetingId) },
    ],
    isDeleted: false,
  });

  if (!booking) {
    console.warn(`⚠️ Zoom webhook: no booking found for meeting ${meetingId}`);
    return null;
  }

  if (event === "meeting.started") {
    booking.status = "in_progress";
    booking.actualStartTime = payload.object?.start_time
      ? new Date(payload.object.start_time)
      : new Date();
    await booking.save();
    return booking;
  }

  if (event === "meeting.ended") {
    const endTime = payload.object?.end_time
      ? new Date(payload.object.end_time)
      : new Date();
    const startTime =
      booking.actualStartTime ||
      (payload.object?.start_time ? new Date(payload.object.start_time) : null);

    booking.status = "completed";
    booking.actualEndTime = endTime;

    if (startTime) {
      booking.actualDurationSeconds = Math.max(
        0,
        Math.round((endTime.getTime() - startTime.getTime()) / 1000),
      );
    } else if (payload.object?.duration) {
      booking.actualDurationSeconds = Number(payload.object.duration) * 60;
    }

    await booking.save();
    return booking;
  }

  return null;
};

function formatBookingResponse(booking, mentor) {
  return {
    id: booking._id,
    mentorId: booking.mentorId?._id || booking.mentorId,
    mentorName: mentor?.name || booking.mentorId?.name,
    mentorImage: mentor?.image || booking.mentorId?.image,
    dateKey: booking.dateKey,
    slotId: booking.slotId,
    slotLabel: booking.slotLabel,
    scheduledAt: booking.scheduledAt,
    userEmail: booking.guestDetails.email,
    userName: booking.guestDetails.fullName,
    status: booking.status,
    zoomMeetingId: booking.zoomMeetingId,
    zoomPassword: booking.zoomPassword,
    zoomJoinUrl: booking.zoomJoinUrl,
    emailStatus: booking.emailStatus,
    createdAt: booking.createdAt,
  };
}

function formatUserBooking(booking) {
  const mentor = booking.mentorId;
  return {
    _id: booking._id,
    status: booking.status,
    scheduledAt: booking.scheduledAt,
    slotLabel: booking.slotLabel,
    dateKey: booking.dateKey,
    durationMinutes: booking.durationMinutes,
    mentor: mentor
      ? {
          _id: mentor._id,
          name: mentor.name,
          email: mentor.email,
          image: mentor.image,
        }
      : null,
    zoomMeetingId: booking.zoomMeetingId,
    zoomJoinUrl: booking.zoomJoinUrl,
    zoomPassword: booking.zoomPassword,
    createdAt: booking.createdAt,
  };
}

function formatMentorAppointment(booking) {
  return {
    _id: booking._id,
    status: booking.status,
    scheduledAt: booking.scheduledAt,
    slotLabel: booking.slotLabel,
    dateKey: booking.dateKey,
    guestDetails: booking.guestDetails,
    actualDurationSeconds: booking.actualDurationSeconds,
    actualStartTime: booking.actualStartTime,
    actualEndTime: booking.actualEndTime,
    zoomMeetingId: booking.zoomMeetingId,
    zoomStartUrl: booking.zoomStartUrl,
    zoomPassword: booking.zoomPassword,
    createdAt: booking.createdAt,
  };
}

function formatAdminBooking(booking) {
  const mentor = booking.mentorId;
  const user = booking.userId;
  return {
    _id: booking._id,
    status: booking.status,
    scheduledAt: booking.scheduledAt,
    slotLabel: booking.slotLabel,
    dateKey: booking.dateKey,
    durationMinutes: booking.durationMinutes,
    actualStartTime: booking.actualStartTime,
    actualEndTime: booking.actualEndTime,
    actualDurationSeconds: booking.actualDurationSeconds,
    actualDurationMinutes: booking.actualDurationSeconds
      ? Math.ceil(booking.actualDurationSeconds / 60)
      : null,
    zoomMeetingId: booking.zoomMeetingId,
    zoomJoinUrl: booking.zoomJoinUrl,
    zoomStartUrl: booking.zoomStartUrl,
    zoomPassword: booking.zoomPassword,
    zoomProvider: booking.zoomProvider,
    emailStatus: booking.emailStatus,
    guestDetails: booking.guestDetails,
    mentor: mentor
      ? { _id: mentor._id, name: mentor.name, email: mentor.email, image: mentor.image }
      : null,
    user: user
      ? { _id: user._id, name: user.name, email: user.email, mobile: user.mobile }
      : null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
