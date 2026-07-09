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

function generateRtcToken(channelName, account) {
  if (!isAgoraConfigured()) {
    return "mock_agora_token";
  }

  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;
  const ttl = parseInt(process.env.AGORA_TOKEN_TTL_SECONDS || "3600", 10);
  const expireTime = Math.floor(Date.now() / 1000) + ttl;

  return RtcTokenBuilder.buildTokenWithAccount(
    appId,
    certificate,
    channelName,
    String(account),
    RtcRole.PUBLISHER,
    expireTime,
  );
}

function buildAgoraSession(channelName, userId) {
  const uid = String(userId);
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
  generateRtcToken,
  buildAgoraSession,
};
