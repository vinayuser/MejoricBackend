const Mate = require("../../models/Mate");
const User = require("../../models/User");
const MateAvailabilitySession = require("../../models/MateAvailabilitySession");
const { ROLES } = require("../../constants");
const { getISTDayKey, formatDuration } = require("../../helpers/istDate");
const { emitMateAvailabilityTracking } = require("../../helpers/socket");
const { logMateActivity } = require("./activityLog");

exports.recordMateAvailabilityChange = async ({
  mateUser,
  previousAvailable,
  newAvailable,
  source = "mate_app",
}) => {
  if (previousAvailable === newAvailable) return null;

  const mateUserId = mateUser._id;
  const now = new Date();
  const dayKey = getISTDayKey(now);
  let closedSessionDuration = 0;

  if (newAvailable) {
    await MateAvailabilitySession.create({
      mateUserId,
      startedAt: now,
      endedAt: null,
      dayKey,
      source,
    });

    await logMateActivity({
      mateUserId,
      mateName: mateUser.name,
      mobile: mateUser.mobile,
      activity: "online",
      at: now,
      dayKey,
      source,
    });
  } else {
    const openSession = await MateAvailabilitySession.findOne({
      mateUserId,
      endedAt: null,
    }).sort({ startedAt: -1 });

    if (openSession) {
      openSession.endedAt = now;
      closedSessionDuration = Math.max(
        0,
        Math.floor((now - new Date(openSession.startedAt)) / 1000),
      );
      openSession.durationSeconds = closedSessionDuration;
      await openSession.save();
    }

    await logMateActivity({
      mateUserId,
      mateName: mateUser.name,
      mobile: mateUser.mobile,
      activity: "offline",
      at: now,
      dayKey,
      source,
      durationSeconds: closedSessionDuration || null,
    });
  }

  const snapshot = await exports.getMateTrackingSnapshot(dayKey);
  const mateRow = snapshot.find(
    (row) => String(row.mateUserId) === String(mateUserId),
  );

  emitMateAvailabilityTracking({
    event: "MATE_AVAILABILITY_CHANGED",
    mateUserId: String(mateUserId),
    mateName: mateUser.name || "",
    isAvailable: newAvailable,
    source,
    changedAt: now.toISOString(),
    mate: mateRow || null,
    dayKey,
  });

  return mateRow;
};

exports.getMateTrackingSnapshot = async (dateKey = getISTDayKey()) => {
  const mates = await User.aggregate([
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
    { $unwind: { path: "$mate", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        name: 1,
        email: 1,
        mobile: 1,
        isOnline: 1,
        "mate.isAvailable": 1,
        "mate.isBusy": 1,
      },
    },
    { $sort: { name: 1 } },
  ]);

  if (!mates.length) return [];

  const mateUserIds = mates.map((m) => m._id);

  const [daySessions, openSessions] = await Promise.all([
    MateAvailabilitySession.find({
      mateUserId: { $in: mateUserIds },
      dayKey: dateKey,
    })
      .sort({ startedAt: 1 })
      .lean(),
    MateAvailabilitySession.find({
      mateUserId: { $in: mateUserIds },
      endedAt: null,
    }).lean(),
  ]);

  const openByMate = new Map(
    openSessions.map((s) => [String(s.mateUserId), s]),
  );

  const rows = mates.map((mate) => {
    const id = String(mate._id);
    const sessions = daySessions.filter((s) => String(s.mateUserId) === id);
    const open = openByMate.get(id);
    const isAvailable = Boolean(mate.mate?.isAvailable);

    let totalOnlineSecondsToday = sessions.reduce(
      (sum, s) => sum + (s.durationSeconds || 0),
      0,
    );

    if (open && isAvailable) {
      totalOnlineSecondsToday += Math.max(
        0,
        Math.floor((Date.now() - new Date(open.startedAt)) / 1000),
      );
    }

    const toggleCountToday = sessions.length;
    const lastSession = sessions[sessions.length - 1];

    let lastChangeAt = null;
    let lastChangeType = null;
    if (isAvailable && open) {
      lastChangeAt = open.startedAt;
      lastChangeType = "online";
    } else if (lastSession) {
      if (lastSession.endedAt) {
        lastChangeAt = lastSession.endedAt;
        lastChangeType = "offline";
      } else {
        lastChangeAt = lastSession.startedAt;
        lastChangeType = "online";
      }
    }

    return {
      mateUserId: mate._id,
      name: mate.name,
      email: mate.email,
      mobile: mate.mobile,
      isAvailable,
      isBusy: Boolean(mate.mate?.isBusy),
      isOnline: Boolean(mate.isOnline),
      toggleCountToday,
      totalOnlineSecondsToday,
      totalOnlineFormatted: formatDuration(totalOnlineSecondsToday),
      currentSessionStartedAt: open?.startedAt || null,
      lastChangeAt,
      lastChangeType,
      lastChangeSource: lastSession?.source || null,
      sessionsToday: sessions.map((s) => ({
        _id: s._id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: s.durationSeconds,
        durationFormatted: s.durationSeconds
          ? formatDuration(s.durationSeconds)
          : isAvailable && open && String(open._id) === String(s._id)
            ? formatDuration(
                Math.floor((Date.now() - new Date(s.startedAt)) / 1000),
              )
            : "—",
        source: s.source,
      })),
    };
  });

  rows.sort((a, b) => {
    const ta = a.lastChangeAt ? new Date(a.lastChangeAt).getTime() : 0;
    const tb = b.lastChangeAt ? new Date(b.lastChangeAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  return rows;
};

const buildActivityFeed = (mates) => {
  const events = [];

  for (const mate of mates) {
    for (const session of mate.sessionsToday || []) {
      events.push({
        id: `${session._id}-online`,
        mateUserId: mate.mateUserId,
        mateName: mate.name,
        mobile: mate.mobile,
        type: "online",
        at: session.startedAt,
        source: session.source,
        isActive:
          mate.isAvailable &&
          !session.endedAt &&
          mate.currentSessionStartedAt &&
          new Date(session.startedAt).getTime() ===
            new Date(mate.currentSessionStartedAt).getTime(),
      });

      if (session.endedAt) {
        events.push({
          id: `${session._id}-offline`,
          mateUserId: mate.mateUserId,
          mateName: mate.name,
          mobile: mate.mobile,
          type: "offline",
          at: session.endedAt,
          source: session.source,
          durationSeconds: session.durationSeconds || 0,
          isActive: false,
        });
      }
    }
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events;
};

exports.getMateActivityFeed = (mates) => buildActivityFeed(mates);

exports.getMateSessionHistory = async (mateUserId, dateKey = getISTDayKey()) => {
  return MateAvailabilitySession.find({ mateUserId, dayKey: dateKey })
    .sort({ startedAt: -1 })
    .lean();
};
