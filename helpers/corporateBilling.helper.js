const User = require("../models/User");
const Corporate = require("../models/Corporate");

function normalizeEmailDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function emailMatchesCorporateDomain(email, domain) {
  const normalizedDomain = normalizeEmailDomain(domain);
  if (!normalizedDomain || !email) return false;
  return email.toLowerCase().trim().endsWith(`@${normalizedDomain}`);
}

function getRemainingMinutes(corporate, type) {
  const totalKey = `${type}MinutesTotal`;
  const usedKey = `${type}MinutesUsed`;
  const total = corporate?.[totalKey] ?? 0;
  const used = corporate?.[usedKey] ?? 0;
  return Math.max(0, total - used);
}

function getCorporateUsageSummary(corporate) {
  if (!corporate) return null;
  const doc =
    typeof corporate.toObject === "function"
      ? corporate.toObject()
      : { ...corporate };
  return {
    corporateId: doc._id,
    name: doc.name,
    audioMinutesRemaining: getRemainingMinutes(doc, "audio"),
    videoMinutesRemaining: getRemainingMinutes(doc, "video"),
    chatMinutesRemaining: getRemainingMinutes(doc, "chat"),
    audioMinutesTotal: doc.audioMinutesTotal ?? 0,
    videoMinutesTotal: doc.videoMinutesTotal ?? 0,
    chatMinutesTotal: doc.chatMinutesTotal ?? 0,
    audioMinutesUsed: doc.audioMinutesUsed ?? 0,
    videoMinutesUsed: doc.videoMinutesUsed ?? 0,
    chatMinutesUsed: doc.chatMinutesUsed ?? 0,
  };
}

async function getCorporateForUser(userId) {
  const user = await User.findById(userId).select("corporateId");
  if (!user?.corporateId) return null;
  return Corporate.findOne({
    _id: user.corporateId,
    isActive: true,
    isDeleted: false,
  });
}

async function hasCorporateMinutes(userId, type, requiredMinutes = 1) {
  const corporate = await getCorporateForUser(userId);
  if (!corporate) return false;
  return getRemainingMinutes(corporate, type) >= requiredMinutes;
}

/**
 * Atomically deduct minutes from a corporate pool if enough remain.
 * @returns {Promise<object|null>} Updated corporate doc or null if insufficient.
 */
async function deductCorporateMinutes(corporateId, type, minutes) {
  const mins = Math.max(0, Math.ceil(Number(minutes) || 0));
  if (mins <= 0) return null;

  const usedKey = `${type}MinutesUsed`;
  const totalKey = `${type}MinutesTotal`;

  return Corporate.findOneAndUpdate(
    {
      _id: corporateId,
      isDeleted: false,
      isActive: true,
      $expr: {
        $lte: [{ $add: [`$${usedKey}`, mins] }, `$${totalKey}`],
      },
    },
    { $inc: { [usedKey]: mins } },
    { new: true },
  );
}

module.exports = {
  normalizeEmailDomain,
  emailMatchesCorporateDomain,
  getRemainingMinutes,
  getCorporateUsageSummary,
  getCorporateForUser,
  hasCorporateMinutes,
  deductCorporateMinutes,
};
