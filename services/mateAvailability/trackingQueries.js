const mongoose = require("mongoose");
const User = require("../../models/User");
const Mate = require("../../models/Mate");
const MateAvailabilitySession = require("../../models/MateAvailabilitySession");
const CallSession = require("../../models/CallSessions");
const ChatSession = require("../../models/ChatSession");
const { MateActivityLog } = require("../../models/MateActivityLog");
const { ROLES } = require("../../constants");
const {
  getISTDayKey,
  getISTDayRange,
  formatDuration,
} = require("../../helpers/istDate");

const parsePagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

const buildMateSearchStage = (search) => {
  const term = (search || "").trim();
  if (!term) return null;

  const mobileNum = term.replace(/\D/g, "").slice(-10);
  const or = [
    { name: { $regex: term, $options: "i" } },
    { email: { $regex: term, $options: "i" } },
  ];
  if (mobileNum.length >= 4) {
    or.push({ mobile: Number(mobileNum) });
  }
  return { $match: { $or: or } };
};

const mateUserBasePipeline = (searchStage) => {
  const stages = [
    { $match: { role: ROLES.MATE, isDeleted: false } },
    {
      $lookup: {
        from: "mates",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$userId", "$$userId"] },
              isDeleted: false,
            },
          },
        ],
        as: "mate",
      },
    },
    { $unwind: { path: "$mate", preserveNullAndEmptyArrays: false } },
  ];
  if (searchStage) stages.push(searchStage);
  return stages;
};

const paginateResult = (items, total, page, limit) => ({
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  },
});

exports.getTrackingOverview = async (dateKey = getISTDayKey()) => {
  const [totalMates, onlineAgg] = await Promise.all([
    User.countDocuments({ role: ROLES.MATE, isDeleted: false }),
    User.aggregate([
      { $match: { role: ROLES.MATE, isDeleted: false } },
      {
        $lookup: {
          from: "mates",
          localField: "_id",
          foreignField: "userId",
          as: "mate",
        },
      },
      { $unwind: "$mate" },
      {
        $match: {
          "mate.isDeleted": false,
          "mate.isAvailable": true,
        },
      },
      { $count: "count" },
    ]),
  ]);

  return {
    dateKey,
    totalMates,
    onlineCount: onlineAgg[0]?.count || 0,
  };
};

exports.getOnlineMatesPaginated = async ({
  dateKey = getISTDayKey(),
  page = 1,
  limit = 10,
  search = "",
}) => {
  const { skip } = parsePagination({ page, limit });
  const searchStage = buildMateSearchStage(search);

  const pipeline = [
    ...mateUserBasePipeline(searchStage),
    { $match: { "mate.isAvailable": true } },
    {
      $lookup: {
        from: "mateavailabilitysessions",
        let: { mateUserId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$mateUserId", "$$mateUserId"] },
                  { $eq: ["$dayKey", dateKey] },
                ],
              },
            },
          },
        ],
        as: "daySessions",
      },
    },
    {
      $lookup: {
        from: "mateavailabilitysessions",
        let: { mateUserId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$mateUserId", "$$mateUserId"] },
                  { $eq: ["$endedAt", null] },
                ],
              },
            },
          },
          { $sort: { startedAt: -1 } },
          { $limit: 1 },
        ],
        as: "openSession",
      },
    },
    {
      $addFields: {
        openSession: { $arrayElemAt: ["$openSession", 0] },
        closedSeconds: {
          $sum: {
            $map: {
              input: "$daySessions",
              as: "s",
              in: { $ifNull: ["$$s.durationSeconds", 0] },
            },
          },
        },
      },
    },
    { $sort: { "openSession.startedAt": -1, name: 1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              mateUserId: "$_id",
              name: 1,
              email: 1,
              mobile: 1,
              isBusy: "$mate.isBusy",
              currentSessionStartedAt: "$openSession.startedAt",
              closedSecondsToday: "$closedSeconds",
            },
          },
        ],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);
  const total = result?.meta?.[0]?.total || 0;
  const items = (result?.items || []).map((row) => ({
    ...row,
    mateUserId: row.mateUserId,
  }));

  return paginateResult(items, total, page, limit);
};

exports.getActivityLogPaginated = async ({
  dateKey = getISTDayKey(),
  page = 1,
  limit = 10,
  search = "",
}) => {
  const { skip } = parsePagination({ page, limit });
  const query = { dayKey: dateKey };

  const term = (search || "").trim();
  if (term) {
    const mobileNum = term.replace(/\D/g, "").slice(-10);
    const or = [{ mateName: { $regex: term, $options: "i" } }];
    if (mobileNum.length >= 4) {
      or.push({ mobile: Number(mobileNum) });
    }
    query.$or = or;
  }

  const [rows, total, openSessions] = await Promise.all([
    MateActivityLog.find(query).sort({ at: -1 }).skip(skip).limit(limit).lean(),
    MateActivityLog.countDocuments(query),
    MateAvailabilitySession.find({ endedAt: null }).lean(),
  ]);

  const openByMate = new Map(
    openSessions.map((s) => [String(s.mateUserId), s]),
  );

  const items = rows.map((row) => {
    const open = openByMate.get(String(row.mateUserId));
    const isActive =
      row.activity === "online" &&
      open &&
      new Date(open.startedAt).getTime() === new Date(row.at).getTime();

    return {
      id: String(row._id),
      mateUserId: row.mateUserId,
      mateName: row.mateName,
      mobile: row.mobile,
      activity: row.activity,
      at: row.at,
      source: row.source,
      durationSeconds: row.durationSeconds,
      isActive,
      durationFormatted:
        row.activity === "offline" && row.durationSeconds
          ? formatDuration(row.durationSeconds)
          : null,
    };
  });

  return paginateResult(items, total, page, limit);
};

exports.getMateSummaryPaginated = async ({
  dateKey = getISTDayKey(),
  page = 1,
  limit = 10,
  search = "",
}) => {
  const { skip } = parsePagination({ page, limit });
  const searchStage = buildMateSearchStage(search);

  const pipeline = [
    ...mateUserBasePipeline(searchStage),
    {
      $lookup: {
        from: "mateavailabilitysessions",
        let: { mateUserId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$mateUserId", "$$mateUserId"] },
                  { $eq: ["$dayKey", dateKey] },
                ],
              },
            },
          },
          { $sort: { startedAt: 1 } },
        ],
        as: "daySessions",
      },
    },
    {
      $lookup: {
        from: "mateavailabilitysessions",
        let: { mateUserId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$mateUserId", "$$mateUserId"] },
                  { $eq: ["$endedAt", null] },
                ],
              },
            },
          },
          { $sort: { startedAt: -1 } },
          { $limit: 1 },
        ],
        as: "openSession",
      },
    },
    {
      $addFields: {
        openSession: { $arrayElemAt: ["$openSession", 0] },
        lastSession: { $arrayElemAt: ["$daySessions", -1] },
        closedSeconds: {
          $sum: {
            $map: {
              input: "$daySessions",
              as: "s",
              in: { $ifNull: ["$$s.durationSeconds", 0] },
            },
          },
        },
        toggleCountToday: { $size: "$daySessions" },
      },
    },
    {
      $addFields: {
        lastChangeAt: {
          $cond: [
            "$mate.isAvailable",
            "$openSession.startedAt",
            {
              $ifNull: ["$lastSession.endedAt", "$lastSession.startedAt"],
            },
          ],
        },
        lastChangeType: {
          $cond: ["$mate.isAvailable", "online", "offline"],
        },
      },
    },
    { $sort: { lastChangeAt: -1, name: 1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              mateUserId: "$_id",
              name: 1,
              email: 1,
              mobile: 1,
              isAvailable: "$mate.isAvailable",
              isBusy: "$mate.isBusy",
              toggleCountToday: 1,
              closedSecondsToday: "$closedSeconds",
              currentSessionStartedAt: "$openSession.startedAt",
              lastChangeAt: 1,
              lastChangeType: 1,
            },
          },
        ],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);
  const total = result?.meta?.[0]?.total || 0;
  const items = result?.items || [];

  return paginateResult(items, total, page, limit);
};

exports.getMateDailyServiceStats = async (
  mateUserId,
  dateKey = getISTDayKey(),
) => {
  const mateObjectId = new mongoose.Types.ObjectId(mateUserId);
  const user = await User.findOne({
    _id: mateObjectId,
    role: ROLES.MATE,
    isDeleted: false,
  })
    .select("name email mobile")
    .lean();

  if (!user) return null;

  const { startOfDay, endOfDay } = getISTDayRange(dateKey);
  const mateIdStr = String(mateUserId);

  const [callsFixed, chats, availSessions, mate] = await Promise.all([
    CallSession.find({
      callStatus: "ENDED",
      $and: [
        { $or: [{ callerId: mateObjectId }, { receiverId: mateObjectId }] },
        {
          $or: [
            { startTime: { $gte: startOfDay, $lte: endOfDay } },
            {
              $and: [
                { $or: [{ startTime: null }, { startTime: { $exists: false } }] },
                { createdAt: { $gte: startOfDay, $lte: endOfDay } },
              ],
            },
          ],
        },
      ],
    }).lean(),
    ChatSession.find({
      status: "ENDED",
      $or: [{ senderId: mateObjectId }, { recipientId: mateObjectId }],
      startTime: { $gte: startOfDay, $lte: endOfDay },
    }).lean(),
    MateAvailabilitySession.find({ mateUserId: mateObjectId, dayKey: dateKey }).lean(),
    Mate.findOne({ userId: mateObjectId, isDeleted: false })
      .select("isAvailable")
      .lean(),
  ]);

  const callCustomers = new Set();
  let audioCalls = 0;
  let videoCalls = 0;
  let totalCallSeconds = 0;
  let totalCallAmount = 0;

  for (const call of callsFixed) {
    const otherId =
      String(call.callerId) === mateIdStr ? call.receiverId : call.callerId;
    callCustomers.add(String(otherId));
    if (call.callType === "AUDIO") audioCalls += 1;
    if (call.callType === "VIDEO") videoCalls += 1;
    totalCallSeconds += call.duration || 0;
    totalCallAmount += call.totalAmountDeducted || 0;
  }

  const chatCustomers = new Set();
  let totalMessages = 0;
  let totalChatSeconds = 0;
  let totalChatAmount = 0;

  for (const chat of chats) {
    const otherId =
      String(chat.senderId) === mateIdStr ? chat.recipientId : chat.senderId;
    chatCustomers.add(String(otherId));
    totalMessages += chat.messageCount || 0;
    totalChatSeconds += chat.duration || 0;
    totalChatAmount += chat.totalAmountDeducted || 0;
  }

  const allCustomers = new Set([...callCustomers, ...chatCustomers]);

  let totalOnlineSeconds = availSessions.reduce(
    (sum, s) => sum + (s.durationSeconds || 0),
    0,
  );
  const openSession = availSessions.find((s) => !s.endedAt);
  if (openSession && mate?.isAvailable) {
    totalOnlineSeconds += Math.max(
      0,
      Math.floor((Date.now() - new Date(openSession.startedAt)) / 1000),
    );
  }

  return {
    dateKey,
    mate: {
      mateUserId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isAvailable: Boolean(mate?.isAvailable),
    },
    availability: {
      toggleCount: availSessions.length,
      totalOnlineSeconds,
      totalOnlineFormatted: formatDuration(totalOnlineSeconds),
    },
    customersServed: allCustomers.size,
    calls: {
      total: callsFixed.length,
      audio: audioCalls,
      video: videoCalls,
      uniqueCustomers: callCustomers.size,
      totalDurationSeconds: totalCallSeconds,
      totalDurationFormatted: formatDuration(totalCallSeconds),
      totalAmountDeducted: totalCallAmount,
    },
    chats: {
      total: chats.length,
      uniqueCustomers: chatCustomers.size,
      totalMessages,
      totalDurationSeconds: totalChatSeconds,
      totalDurationFormatted: formatDuration(totalChatSeconds),
      totalAmountDeducted: totalChatAmount,
    },
  };
};
