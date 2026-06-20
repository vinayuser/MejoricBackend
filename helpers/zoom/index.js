const axios = require("axios");
const crypto = require("crypto");

let cachedToken = null;
let tokenExpiresAt = 0;

function isZoomConfigured() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET,
  );
}

async function getZoomAccessToken() {
  if (!isZoomConfigured()) {
    throw new Error("Zoom API credentials are not configured");
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    null,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    },
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in || 3600) * 1000;
  return cachedToken;
}

function buildMockMeeting({ topic, startTime }) {
  const meetingId = String(Math.floor(1000000000 + Math.random() * 9000000000));
  const password = Math.random().toString(36).slice(2, 8);
  return {
    provider: "mock",
    meetingId,
    meetingUuid: `mock-${meetingId}`,
    joinUrl: `https://zoom.us/j/${meetingId}?pwd=${password}`,
    startUrl: `https://zoom.us/s/${meetingId}?pwd=${password}`,
    password,
    topic,
    startTime,
  };
}

async function createZoomMeeting({ topic, startTime, durationMinutes = 30 }) {
  if (!isZoomConfigured()) {
    console.warn("⚠️ Zoom not configured — using mock meeting for booking");
    return buildMockMeeting({ topic, startTime });
  }

  const token = await getZoomAccessToken();
  const zoomUserId = process.env.ZOOM_USER_ID || "me";

  const response = await axios.post(
    `https://api.zoom.us/v2/users/${encodeURIComponent(zoomUserId)}/meetings`,
    {
      topic,
      type: 2,
      start_time: startTime.toISOString(),
      duration: durationMinutes,
      timezone: "Asia/Kolkata",
      settings: {
        join_before_host: true,
        waiting_room: true,
        approval_type: 2,
        auto_recording: "none",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const meeting = response.data;
  return {
    provider: "zoom",
    meetingId: String(meeting.id),
    meetingUuid: meeting.uuid,
    joinUrl: meeting.join_url,
    startUrl: meeting.start_url,
    password: meeting.password,
    topic: meeting.topic,
    startTime: meeting.start_time,
  };
}

function verifyZoomWebhookSignature(req, rawBody) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) return true;

  const timestamp = req.headers["x-zm-request-timestamp"];
  const signature = req.headers["x-zm-signature"];
  if (!timestamp || !signature) return false;

  const message = `v0:${timestamp}:${rawBody.toString()}`;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = `v0=${hash}`;
  return expected === signature;
}

function handleZoomUrlValidation(payload) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
  const encryptedToken = crypto
    .createHmac("sha256", secret)
    .update(payload.plainToken)
    .digest("hex");

  return {
    plainToken: payload.plainToken,
    encryptedToken,
  };
}

module.exports = {
  isZoomConfigured,
  createZoomMeeting,
  verifyZoomWebhookSignature,
  handleZoomUrlValidation,
};
