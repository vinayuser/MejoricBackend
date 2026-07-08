const DEFAULT_AUDIO_PRICE_PER_MIN = 12;
const DEFAULT_VIDEO_PRICE_PER_MIN = 15;

const FORMAT_DURATIONS = {
  audio: 45,
  video: 45,
  video60: 60,
};

function normalizePrice(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  // Legacy session totals stored before per-minute pricing
  if (num > 100) return Math.max(1, Math.round(num / 45));
  return Math.round(num);
}

function resolveMentorPrices(mentorDoc = {}) {
  const videoCallPrice = normalizePrice(
    mentorDoc.videoCallPrice,
    DEFAULT_VIDEO_PRICE_PER_MIN,
  );
  const audioCallPrice = normalizePrice(
    mentorDoc.audioCallPrice,
    DEFAULT_AUDIO_PRICE_PER_MIN,
  );
  const video60CallPrice = normalizePrice(
    mentorDoc.video60CallPrice,
    videoCallPrice,
  );

  return { audioCallPrice, videoCallPrice, video60CallPrice };
}

function getMentorPricePerMin(mentorDoc, sessionFormat = "video") {
  const prices = resolveMentorPrices(mentorDoc);
  if (sessionFormat === "audio") return prices.audioCallPrice;
  if (sessionFormat === "video60") return prices.video60CallPrice;
  return prices.videoCallPrice;
}

function getMentorSessionDuration(sessionFormat = "video") {
  return FORMAT_DURATIONS[sessionFormat] || FORMAT_DURATIONS.video;
}

function getMentorSessionPrice(mentorDoc, sessionFormat = "video") {
  const perMin = getMentorPricePerMin(mentorDoc, sessionFormat);
  const duration = getMentorSessionDuration(sessionFormat);
  return perMin * duration;
}

function isValidSessionFormat(format) {
  return ["audio", "video", "video60"].includes(format);
}

module.exports = {
  DEFAULT_AUDIO_PRICE_PER_MIN,
  DEFAULT_VIDEO_PRICE_PER_MIN,
  FORMAT_DURATIONS,
  resolveMentorPrices,
  getMentorPricePerMin,
  getMentorSessionPrice,
  getMentorSessionDuration,
  isValidSessionFormat,
};
