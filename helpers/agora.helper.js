const crypto = require("crypto");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const { agoraConfig } = require("../configs/agora");

const AGORA_UID_MAX = 0xffffffff;

function assertAgoraConfigured() {
  if (!agoraConfig.APP_ID || !agoraConfig.APP_CERTIFICATE) {
    throw new Error(
      "Agora is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in Server/.env",
    );
  }
}

/**
 * Two unique numeric UIDs per call session (avoids caller/receiver hash collisions).
 * Deterministic from session id so accept/retry returns the same pair.
 */
function allocateCallAgoraUids(callSessionId) {
  const hash = crypto.createHash("sha256").update(String(callSessionId)).digest();
  const callerUid = (hash.readUInt32BE(0) % (AGORA_UID_MAX - 1)) + 1;
  let receiverUid = (hash.readUInt32BE(4) % (AGORA_UID_MAX - 1)) + 1;
  if (receiverUid === callerUid) {
    receiverUid = (callerUid % (AGORA_UID_MAX - 2)) + 2;
  }
  return { callerUid, receiverUid };
}

/** @deprecated Use allocateCallAgoraUids per call session instead. */
function userIdToAgoraUid(userId) {
  const hex = userId.toString().slice(-8);
  const uid = parseInt(hex, 16) % 2147483646;
  return uid > 0 ? uid : 1;
}

function buildChannelName(callerId, receiverId) {
  const ts = Date.now().toString(36);
  return `call_${callerId.toString().slice(-6)}_${receiverId.toString().slice(-6)}_${ts}`.slice(
    0,
    64,
  );
}

function createRtcToken(channelName, uid) {
  assertAgoraConfigured();

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs =
    currentTimestamp + agoraConfig.TOKEN_TTL_SECONDS;

  return RtcTokenBuilder.buildTokenWithUid(
    agoraConfig.APP_ID,
    agoraConfig.APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
  );
}

function getAgoraAppId() {
  return agoraConfig.APP_ID;
}

module.exports = {
  allocateCallAgoraUids,
  buildChannelName,
  createRtcToken,
  getAgoraAppId,
  userIdToAgoraUid,
};
