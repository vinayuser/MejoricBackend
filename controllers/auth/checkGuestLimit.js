const User = require("../../models/User");
const ChatSession = require("../../models/ChatSession");
const { ROLES } = require("../../constants");
const { asyncWrapper, sendSuccess } = require("../../utils");
const { getClientIp } = require("../../helpers/clientIp");

exports.checkGuestLimit = asyncWrapper(async (req, res) => {
  const clientIp = getClientIp(req);

  const guestUsersFromIp = await User.find({
    ipAddress: clientIp,
    role: ROLES.GUEST,
    isDeleted: false,
  }).select("_id");
  const guestIds = guestUsersFromIp.map((u) => u._id);

  let consumedSeconds = 0;
  if (guestIds.length) {
    const endedSessions = await ChatSession.find({
      $or: [
        { senderId: { $in: guestIds } },
        { recipientId: { $in: guestIds } },
      ],
      status: "ENDED",
    });
    for (const sess of endedSessions) {
      consumedSeconds += sess.duration || 0;
    }
  }

  const totalAllowed = parseInt(process.env.TRIAL_CHAT_DURATION, 10) || 180;
  const isExhausted = consumedSeconds >= totalAllowed;

  return sendSuccess(res, 200, "Guest limit check successful", {
    isExhausted,
    remainingSeconds: Math.max(0, totalAllowed - consumedSeconds),
    ipAddress: clientIp,
  });
});
