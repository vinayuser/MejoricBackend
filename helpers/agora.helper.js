const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

function isAgoraConfigured() {
  return Boolean(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
}

/** Agora channel for instant mate audio/video calls. */
function buildCallChannelName(callSessionId) {
  return `mc_${String(callSessionId)}`;
}

function buildBookingChannelName(bookingId) {
  return `mb_${String(bookingId)}`;
}

/**
 * Agora Web SDK works reliably with numeric UIDs.
 * Mongo ObjectId strings need "String UID" enabled in Agora Console — avoid that.
 * Hash userId → uint32 (never 0; 0 means "auto-assign").
 */
function toAgoraUid(userId) {
  const s = String(userId || "");
  let hash = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const uid = hash >>> 0;
  return uid === 0 ? 1 : uid;
}

function generateRtcToken(channelName, uid) {
  if (!isAgoraConfigured()) {
    return "mock_agora_token";
  }

  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;
  const ttl = parseInt(process.env.AGORA_TOKEN_TTL_SECONDS || "3600", 10);
  const expireTime = Math.floor(Date.now() / 1000) + ttl;
  const numericUid = Number(uid);

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    certificate,
    channelName,
    numericUid,
    RtcRole.PUBLISHER,
    expireTime,
  );
}

function buildAgoraSession(channelName, userId) {
  const uid = toAgoraUid(userId);
  return {
    appId: process.env.AGORA_APP_ID || "",
    channelName,
    token: generateRtcToken(channelName, uid),
    uid,
  };
}

module.exports = {
  isAgoraConfigured,
  buildCallChannelName,
  buildBookingChannelName,
  toAgoraUid,
  generateRtcToken,
  buildAgoraSession,
};
