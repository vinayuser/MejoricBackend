const TherapyCohort = require("../../models/TherapyCohort");
const { throwError, pagination } = require("../../utils");

function normalizeSlots(slots = [], defaultDuration = 90) {
  if (!Array.isArray(slots)) return [];
  return slots
    .map((s, i) => {
      const scheduledAt = s.scheduledAt ? new Date(s.scheduledAt) : null;
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return null;
      return {
        label: s.label || `Session ${i + 1}`,
        scheduledAt,
        durationMinutes: Number(s.durationMinutes) || defaultDuration,
        meetingUrl: s.meetingUrl || "",
        meetingPassword: s.meetingPassword || "",
        agoraChannelName: s.agoraChannelName || "",
        status: s.status || "scheduled",
        ...(s._id ? { _id: s._id } : {}),
      };
    })
    .filter(Boolean);
}

function ensureSlotChannels(cohort) {
  let changed = false;
  for (const slot of cohort.slots || []) {
    if (!slot.agoraChannelName) {
      slot.agoraChannelName = `therapy_${cohort._id}_${slot._id}`;
      changed = true;
    }
  }
  return changed;
}

exports.formatCohortPublic = (
  doc,
  { enrolled = false, enrollmentId = null, waitlisted = false } = {},
) => {
  const c = doc.toObject ? doc.toObject({ virtuals: true }) : doc;
  const seatsLeft = Math.max(0, (c.totalSeats || 0) - (c.takenSeats || 0));
  return {
    id: String(c._id),
    _id: c._id,
    theme: c.theme,
    tag: c.tag,
    band: c.band,
    description: c.description || c.sub || "",
    sub: c.description || "",
    who: c.who || "",
    approach: c.approach || "",
    psych: c.psychologistLabel || "",
    psychologistLabel: c.psychologistLabel || "",
    sessions: c.sessionsCount,
    sessionsCount: c.sessionsCount,
    dur: `${c.durationMinutes || 90} min`,
    durationMinutes: c.durationMinutes,
    day: c.dayLabel,
    dayLabel: c.dayLabel,
    total: c.totalSeats,
    totalSeats: c.totalSeats,
    taken: c.takenSeats,
    takenSeats: c.takenSeats,
    seatsLeft,
    price: c.price,
    priceLabel: `₹${Number(c.price).toLocaleString("en-IN")}`,
    status: c.status,
    isActive: c.isActive,
    enrolled,
    waitlisted,
    enrollmentId,
    slots: (c.slots || []).map((s) => ({
      id: String(s._id),
      label: s.label,
      scheduledAt: s.scheduledAt,
      durationMinutes: s.durationMinutes,
      status: s.status,
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

exports.createCohort = async (payload) => {
  const price = Number(payload.price);
  const totalSeats = Number(payload.totalSeats) || 8;
  if (!payload.theme?.trim()) throwError(422, "Theme is required");
  if (!Number.isFinite(price) || price < 1) throwError(422, "Valid price is required");

  const durationMinutes = Number(payload.durationMinutes) || 90;
  const slots = normalizeSlots(payload.slots, durationMinutes);

  const cohort = await TherapyCohort.create({
    theme: payload.theme.trim(),
    tag: payload.tag || "",
    band: payload.band || "#7c6ba8",
    description: payload.description || payload.sub || "",
    who: payload.who || "",
    approach: payload.approach || "",
    psychologistLabel: payload.psychologistLabel || payload.psych || "",
    sessionsCount: Number(payload.sessionsCount) || slots.length || 6,
    durationMinutes,
    dayLabel: payload.dayLabel || payload.day || "",
    price,
    totalSeats,
    takenSeats: 0,
    waitlistEnabled: payload.waitlistEnabled !== false,
    slots,
    status: payload.status || "open",
    isActive: payload.isActive !== false && payload.isActive !== "false",
  });

  if (ensureSlotChannels(cohort)) await cohort.save();
  return cohort;
};

exports.updateCohort = async (id, payload) => {
  const cohort = await TherapyCohort.findOne({ _id: id, isDeleted: false });
  if (!cohort) throwError(404, "Cohort not found");

  const fields = [
    "theme",
    "tag",
    "band",
    "description",
    "who",
    "approach",
    "psychologistLabel",
    "dayLabel",
    "status",
  ];
  for (const f of fields) {
    if (typeof payload[f] !== "undefined") cohort[f] = payload[f];
  }
  if (typeof payload.psych !== "undefined") cohort.psychologistLabel = payload.psych;
  if (typeof payload.sub !== "undefined") cohort.description = payload.sub;
  if (typeof payload.day !== "undefined") cohort.dayLabel = payload.day;

  if (typeof payload.price !== "undefined") {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 1) throwError(422, "Invalid price");
    cohort.price = price;
  }
  if (typeof payload.totalSeats !== "undefined") {
    const seats = Number(payload.totalSeats);
    if (!Number.isFinite(seats) || seats < 1) throwError(422, "Invalid seat count");
    if (seats < cohort.takenSeats) {
      throwError(400, `Cannot set seats below current enrollments (${cohort.takenSeats})`);
    }
    cohort.totalSeats = seats;
    if (cohort.takenSeats >= seats) cohort.status = "full";
    else if (cohort.status === "full") cohort.status = "open";
  }
  if (typeof payload.sessionsCount !== "undefined") {
    cohort.sessionsCount = Number(payload.sessionsCount) || cohort.sessionsCount;
  }
  if (typeof payload.durationMinutes !== "undefined") {
    cohort.durationMinutes = Number(payload.durationMinutes) || 90;
  }
  if (typeof payload.isActive !== "undefined") {
    cohort.isActive = payload.isActive === true || payload.isActive === "true";
  }
  if (typeof payload.waitlistEnabled !== "undefined") {
    cohort.waitlistEnabled =
      payload.waitlistEnabled === true || payload.waitlistEnabled === "true";
  }
  if (typeof payload.slots !== "undefined") {
    cohort.slots = normalizeSlots(payload.slots, cohort.durationMinutes);
  }

  ensureSlotChannels(cohort);
  await cohort.save();
  return cohort;
};

exports.deleteCohort = async (id) => {
  const cohort = await TherapyCohort.findOne({ _id: id, isDeleted: false });
  if (!cohort) throwError(404, "Cohort not found");
  cohort.isDeleted = true;
  cohort.isActive = false;
  cohort.status = "closed";
  await cohort.save();
  return cohort;
};

exports.getCohortById = async (id) => {
  const cohort = await TherapyCohort.findOne({ _id: id, isDeleted: false });
  if (!cohort) throwError(404, "Cohort not found");
  return cohort;
};

exports.listCohortsAdmin = async (query = {}) => {
  let { page = 1, limit = 20, search, status } = query;
  page = Number(page) || 1;
  limit = Number(limit) || 20;
  const match = { isDeleted: false };
  if (status) match.status = status;
  if (search) {
    match.$or = [
      { theme: { $regex: search, $options: "i" } },
      { tag: { $regex: search, $options: "i" } },
    ];
  }
  const pipeline = [{ $match: match }, { $sort: { createdAt: -1 } }];
  return pagination(TherapyCohort, pipeline, page, limit);
};

exports.listCohortsPublic = async () => {
  return TherapyCohort.find({
    isDeleted: false,
    isActive: true,
    status: { $in: ["open", "full"] },
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
};
