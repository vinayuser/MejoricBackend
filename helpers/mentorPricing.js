const DEFAULT_AUDIO_SESSION_45 = 540;
const DEFAULT_VIDEO_SESSION_45 = 675;

const FORMAT_DURATIONS = {
  audio: 45,
  video: 45,
  video60: 60,
};

/**
 * Prices are the full amount for that slot (e.g. 20 = ₹20 for 45 min).
 * No per-minute conversion or duration multiplication.
 */
function toSessionTotal(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.round(num);
}

function resolveMentorSessionPrices(mentorDoc = {}) {
  const videoCallPrice = toSessionTotal(
    mentorDoc.videoCallPrice,
    DEFAULT_VIDEO_SESSION_45,
  );
  const audioCallPrice = toSessionTotal(
    mentorDoc.audioCallPrice,
    DEFAULT_AUDIO_SESSION_45,
  );
  const video60CallPrice = toSessionTotal(
    mentorDoc.video60CallPrice,
    videoCallPrice,
  );

  return { audioCallPrice, videoCallPrice, video60CallPrice };
}

function getMentorSessionDuration(sessionFormat = "video") {
  return FORMAT_DURATIONS[sessionFormat] || FORMAT_DURATIONS.video;
}

function getMentorSessionPrice(mentorDoc, sessionFormat = "video") {
  const prices = resolveMentorSessionPrices(mentorDoc);
  if (sessionFormat === "audio") return prices.audioCallPrice;
  if (sessionFormat === "video60") return prices.video60CallPrice;
  return prices.videoCallPrice;
}

/** @deprecated kept for callers that still ask for per-min; derived from session total */
function getMentorPricePerMin(mentorDoc, sessionFormat = "video") {
  const session = getMentorSessionPrice(mentorDoc, sessionFormat);
  const duration = getMentorSessionDuration(sessionFormat);
  return Math.max(1, Math.round(session / duration));
}

function isValidSessionFormat(format) {
  return ["audio", "video", "video60"].includes(format);
}

module.exports = {
  DEFAULT_AUDIO_SESSION_45,
  DEFAULT_VIDEO_SESSION_45,
  DEFAULT_AUDIO_PRICE_PER_MIN: 12,
  DEFAULT_VIDEO_PRICE_PER_MIN: 15,
  FORMAT_DURATIONS,
  resolveMentorPrices: resolveMentorSessionPrices,
  resolveMentorSessionPrices,
  getMentorPricePerMin,
  getMentorSessionPrice,
  getMentorSessionDuration,
  isValidSessionFormat,
};
