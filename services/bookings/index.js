const MentorBooking = require("../../models/MentorBooking");
const MentorAvailability = require("../../models/MentorAvailability");
const Mentor = require("../../models/Mentor");
const User = require("../../models/User");
const { ROLES } = require("../../constants");
const { throwError } = require("../../utils");
const { createZoomMeeting } = require("../../helpers/zoom");
const {
  isAgoraConfigured,
  buildBookingChannelName,
} = require("../../helpers/agora.helper");
const mongoose = require("mongoose");
const {
  buildAllSlotsForDate,
  slotIdToDate,
  slotIdToLabel,
  toDateKey,
} = require("../../helpers/bookingSlots");
const {
  sendBookingConfirmationEmails,
} = require("./emailNotifications");
const {
  getMentorSessionPrice,
  getMentorSessionDuration,
  isValidSessionFormat,
} = require("../../helpers/mentorPricing");

async function assertMentorUser(mentorId) {
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    throwError(404, "Mentor not found");
  }
  return mentor;
}

async function resolveSessionPricing(mentorId, sessionFormat) {
  const mentorProfile = await Mentor.findOne({ userId: mentorId, isDeleted: false });
  if (!mentorProfile) {
    throwError(404, "Mentor profile not found");
  }
  const normalizedFormat = isValidSessionFormat(sessionFormat)
    ? sessionFormat
    : "video";
  return {
    sessionFormat: normalizedFormat,
    sessionPrice: getMentorSessionPrice(mentorProfile, normalizedFormat),
    durationMinutes: getMentorSessionDuration(normalizedFormat),
  };
}

async function assertSlotAvailable({ mentorId, dateKey, slotId }) {
  const availability = await MentorAvailability.findOne({
    mentorId,
    dateKey,
    isDeleted: false,
  });

  if (!availability || !availability.slotIds.includes(slotId)) {
    throwError(422, "Selected slot is not available");
  }

  // Always derive IST wall-clock from slotId — never trust client scheduledAt
  const startTime = slotIdToDate(dateKey, slotId);
  if (!startTime || Number.isNaN(startTime.getTime()) || startTime <= new Date()) {
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

  return startTime;
}

exports.createBooking = async ({
  mentorId,
  scheduledAt,
  slotLabel,
  dateKey,
  slotId,
  guestDetails,
  userId,
  sessionFormat = "video",
  paymentStatus = "paid",
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  const mentor = await assertMentorUser(mentorId);
  const pricing = await resolveSessionPricing(mentorId, sessionFormat);
  const startTime = await assertSlotAvailable({
    mentorId,
    dateKey,
    slotId,
  });
  const resolvedSlotLabel = slotIdToLabel(dateKey, slotId) || slotLabel;

  const topic = `Mejoric session with ${guestDetails.fullName}`;
  const bookingId = new mongoose.Types.ObjectId();
  const agoraChannelName = buildBookingChannelName(bookingId);
  const useAgora = isAgoraConfigured();

  let zoomMeeting;
  if (useAgora) {
    zoomMeeting = {
      provider: "agora",
      meetingId: agoraChannelName,
      meetingUuid: agoraChannelName,
      joinUrl: "",
      startUrl: "",
      password: "",
    };
  } else {
    zoomMeeting = await createZoomMeeting({
      topic,
      startTime,
      durationMinutes: pricing.durationMinutes,
    });
  }

  const booking = await MentorBooking.create({
    _id: bookingId,
    mentorId,
    userId: userId || undefined,
    guestDetails,
    scheduledAt: startTime,
    slotLabel: resolvedSlotLabel,
    dateKey,
    slotId,
    sessionFormat: pricing.sessionFormat,
    sessionPrice: pricing.sessionPrice,
    durationMinutes: pricing.durationMinutes,
    paymentStatus,
    razorpayOrderId,
    razorpayPaymentId,
    status: "scheduled",
    agoraChannelName,
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

exports.formatBookingResponse = formatBookingResponse;

exports.getBookedSlotIds = async (mentorId, dateKey) => {
  const bookings = await MentorBooking.find({
    mentorId,
    dateKey,
    isDeleted: false,
    status: { $nin: ["cancelled", "no_show"] },
  }).select("slotId");

  return bookings.map((booking) => booking.slotId);
};

async function getUserBookedSlotsForDate(userId, mentorId, dateKey) {
  if (!userId) return [];

  const user = await User.findById(userId).select("email");
  const identityOr = [{ userId }];
  if (user?.email) {
    identityOr.push({ "guestDetails.email": user.email.toLowerCase() });
  }

  const now = new Date();
  const bookings = await MentorBooking.find({
    mentorId,
    dateKey,
    isDeleted: false,
    status: { $in: ["scheduled", "in_progress"] },
    scheduledAt: { $gte: now },
    $or: identityOr,
  }).select("slotId slotLabel scheduledAt _id sessionFormat");

  return bookings.map((booking) => ({
    id: booking.slotId,
    dateKey,
    label: booking.slotLabel,
    startsAt: booking.scheduledAt.toISOString(),
    bookedByMe: true,
    bookingId: booking._id,
    sessionFormat: booking.sessionFormat,
  }));
}

exports.getPublicAvailableSlots = async (mentorId, dateKey, userId = null) => {
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

  const openSlots = buildAllSlotsForDate(dateKey)
    .filter((slot) => availability.slotIds.includes(slot.id))
    .filter((slot) => !bookedSlotIds.includes(slot.id))
    .filter((slot) => new Date(slot.startsAt) > now);

  const myBookedSlots = await getUserBookedSlotsForDate(userId, mentorId, dateKey);

  return [...myBookedSlots, ...openSlots];
};

exports.getPublicAvailableDates = async (mentorId, year, month, userId = null) => {
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
    const slots = await exports.getPublicAvailableSlots(mentorId, record.dateKey, userId);
    if (slots.length > 0) {
      dates.push(record.dateKey);
    }
  }

  if (userId) {
    const user = await User.findById(userId).select("email");
    const identityOr = [{ userId }];
    if (user?.email) {
      identityOr.push({ "guestDetails.email": user.email.toLowerCase() });
    }

    const myDates = await MentorBooking.find({
      mentorId,
      isDeleted: false,
      status: { $in: ["scheduled", "in_progress"] },
      scheduledAt: { $gte: new Date() },
      dateKey: { $regex: `^${monthPrefix}` },
      $or: identityOr,
    }).distinct("dateKey");

    for (const dateKey of myDates) {
      if (dateKey >= todayKey && !dates.includes(dateKey)) {
        dates.push(dateKey);
      }
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

/**
 * Mentor marks a session completed — Join is disabled for everyone afterwards.
 */
exports.markBookingCompleted = async (mentorId, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throwError(422, "Invalid booking ID");
  }

  const booking = await MentorBooking.findById(bookingId);
  if (!booking || booking.isDeleted) {
    throwError(404, "Booking not found");
  }

  if (String(booking.mentorId) !== String(mentorId)) {
    throwError(403, "Only the assigned mentor can complete this session");
  }

  if (booking.status === "cancelled" || booking.status === "no_show") {
    throwError(400, "This session cannot be marked completed");
  }

  if (booking.status === "completed") {
    return formatMentorAppointment(booking);
  }

  const endTime = new Date();
  booking.status = "completed";
  booking.actualEndTime = endTime;
  if (booking.actualStartTime) {
    booking.actualDurationSeconds = Math.max(
      0,
      Math.round((endTime.getTime() - new Date(booking.actualStartTime).getTime()) / 1000),
    );
  } else if (booking.scheduledAt) {
    const elapsed = Math.round(
      (endTime.getTime() - new Date(booking.scheduledAt).getTime()) / 1000,
    );
    booking.actualDurationSeconds = Math.max(0, elapsed);
  }

  await booking.save();
  return formatMentorAppointment(booking);
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
    // Keep booking in Upcoming until purchased session end (unless mentor completed it)
    filter = {
      isDeleted: false,
      status: { $nin: ["cancelled", "no_show", "completed"] },
      $and: [
        { $or: identityOr },
        {
          $expr: {
            $gte: [
              {
                $add: [
                  "$scheduledAt",
                  {
                    $multiply: [{ $ifNull: ["$durationMinutes", 45] }, 60000],
                  },
                ],
              },
              now,
            ],
          },
        },
      ],
    };
  } else {
    filter = {
      isDeleted: false,
      $and: [
        { $or: identityOr },
        {
          $or: [
            { status: { $in: ["cancelled", "no_show"] } },
            {
              $and: [
                { status: { $in: ["completed", "scheduled", "in_progress"] } },
                {
                  $expr: {
                    $lt: [
                      {
                        $add: [
                          "$scheduledAt",
                          {
                            $multiply: [
                              { $ifNull: ["$durationMinutes", 45] },
                              60000,
                            ],
                          },
                        ],
                      },
                      now,
                    ],
                  },
                },
              ],
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
    // Keep until purchased session end so mentor can rejoin after drops
    filter.status = { $nin: ["cancelled", "no_show", "completed"] };
    filter.$expr = {
      $gte: [
        {
          $add: [
            "$scheduledAt",
            { $multiply: [{ $ifNull: ["$durationMinutes", 45] }, 60000] },
          ],
        },
        now,
      ],
    };
  } else if (tab === "completed") {
    filter.status = { $in: ["completed", "cancelled", "no_show"] };
  } else if (tab === "past") {
    filter.$or = [
      { status: { $in: ["cancelled", "no_show"] } },
      {
        $and: [
          { status: { $in: ["completed", "scheduled", "in_progress"] } },
          {
            $expr: {
              $lt: [
                {
                  $add: [
                    "$scheduledAt",
                    {
                      $multiply: [{ $ifNull: ["$durationMinutes", 45] }, 60000],
                    },
                  ],
                },
                now,
              ],
            },
          },
        ],
      },
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
    sessionFormat: booking.sessionFormat,
    sessionPrice: booking.sessionPrice,
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    agoraChannelName: booking.agoraChannelName,
    zoomProvider: booking.zoomProvider,
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
    slotId: booking.slotId,
    dateKey: booking.dateKey,
    durationMinutes: booking.durationMinutes,
    sessionFormat: booking.sessionFormat,
    sessionPrice: booking.sessionPrice,
    agoraChannelName: booking.agoraChannelName,
    zoomProvider: booking.zoomProvider,
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
    sessionFormat: booking.sessionFormat,
    sessionPrice: booking.sessionPrice,
    durationMinutes: booking.durationMinutes,
    actualDurationSeconds: booking.actualDurationSeconds,
    actualStartTime: booking.actualStartTime,
    actualEndTime: booking.actualEndTime,
    agoraChannelName: booking.agoraChannelName,
    zoomProvider: booking.zoomProvider,
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
