const User = require("../models/User");
const Corporate = require("../models/Corporate");
const { throwError } = require("../utils");

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

function endOfContractDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** True when contractEndDate is set and today is past that day. */
function isCorporateContractExpired(corporate) {
  if (!corporate?.contractEndDate) return false;
  return new Date() > endOfContractDay(corporate.contractEndDate);
}

/**
 * Days remaining until contract end (inclusive of end day).
 * null = open-ended (no end date). 0 = expired.
 */
function getContractRemainingDays(corporate) {
  if (!corporate?.contractEndDate) return null;
  const end = endOfContractDay(corporate.contractEndDate);
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function assertCorporateContractActive(corporate) {
  if (!corporate) return;
  if (corporate.isActive === false) {
    throwError(
      403,
      "This corporate account is inactive. Please contact Mejoric support.",
    );
  }
  if (isCorporateContractExpired(corporate)) {
    throwError(
      403,
      "This company's corporate plan has ended. Please contact Mejoric to renew.",
    );
  }
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
    contractEndDate: doc.contractEndDate || null,
    contractRemainingDays: getContractRemainingDays(doc),
    contractExpired: isCorporateContractExpired(doc),
  };
}

async function getCorporateForUser(userId) {
  const user = await User.findById(userId).select("corporateId");
  if (!user?.corporateId) return null;
  const corporate = await Corporate.findOne({
    _id: user.corporateId,
    isActive: true,
    isDeleted: false,
  });
  if (!corporate || isCorporateContractExpired(corporate)) return null;
  return corporate;
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

  const corporate = await Corporate.findOne({
    _id: corporateId,
    isDeleted: false,
    isActive: true,
  });
  if (!corporate || isCorporateContractExpired(corporate)) return null;

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
  endOfContractDay,
  isCorporateContractExpired,
  getContractRemainingDays,
  assertCorporateContractActive,
  getRemainingMinutes,
  getCorporateUsageSummary,
  getCorporateForUser,
  hasCorporateMinutes,
  deductCorporateMinutes,
};
