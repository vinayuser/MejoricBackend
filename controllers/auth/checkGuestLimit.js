const User = require("../../models/User");
const ChatSession = require("../../models/ChatSession");
const { ROLES } = require("../../constants");
const { asyncWrapper, sendSuccess } = require("../../utils");

exports.checkGuestLimit = asyncWrapper(async (req, res) => {
  let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;
  if (Array.isArray(clientIp)) {
    clientIp = clientIp[0];
  }
  if (typeof clientIp === "string" && clientIp.includes(",")) {
    clientIp = clientIp.split(",")[0].trim();
  }
  if (typeof clientIp === "string" && clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }

  // Find all guest user IDs from this IP
  const guestUsersFromIp = await User.find({
    ipAddress: clientIp,
    role: ROLES.GUEST,
    isDeleted: false,
  }).select("_id");
  const guestIds = guestUsersFromIp.map(u => u._id);

  const endedSessions = await ChatSession.find({
    $or: [
      { senderId: { $in: guestIds } },
      { recipientId: { $in: guestIds } }
    ],
    status: "ENDED"
  });

  let consumedSeconds = 0;
  for (const sess of endedSessions) {
    consumedSeconds += sess.duration || 0;
  }

  const totalAllowed = parseInt(process.env.TRIAL_CHAT_DURATION) || 180;
  const isExhausted = consumedSeconds >= totalAllowed;

  return sendSuccess(res, 200, "Guest limit check successful", {
    isExhausted,
    remainingSeconds: Math.max(0, totalAllowed - consumedSeconds)
  });
});
