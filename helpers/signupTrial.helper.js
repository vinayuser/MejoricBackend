const WalletTransaction = require("../models/WalletTransaction");
const ChatSession = require("../models/ChatSession");
const User = require("../models/User");
const { ROLES } = require("../constants");

function getSignupTrialSeconds() {
  return parseInt(process.env.TRIAL_CHAT_DURATION, 10) || 600;
}

function getSignupTrialStartTime(user) {
  return user?.signupChatTrialStartedAt || user?.createdAt;
}

function getSignupTrialRemainingSeconds(user) {
  if (!user || user.role !== ROLES.USER) {
    return 0;
  }
  const startedAt = getSignupTrialStartTime(user);
  if (!startedAt) {
    return 0;
  }
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  return Math.max(0, getSignupTrialSeconds() - elapsed);
}

function isWithinSignupTrial(user) {
  return getSignupTrialRemainingSeconds(user) > 0;
}

async function hasPaidWalletRecharge(userId) {
  return Boolean(
    await WalletTransaction.exists({
      userId,
      type: "CREDIT",
      status: "SUCCESS",
      source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] },
    }),
  );
}

/** Start the 10-min window for users who signed up before this field existed. */
async function ensureSignupTrialStarted(user) {
  if (!user || user.role !== ROLES.USER || user.signupChatTrialStartedAt) {
    return user;
  }

  const paid = await hasPaidWalletRecharge(user._id);
  if (paid) {
    return user;
  }

  const priorChats = await ChatSession.countDocuments({
    $or: [{ senderId: user._id }, { recipientId: user._id }],
    status: "ENDED",
  });
  if (priorChats > 0) {
    return user;
  }

  return User.findByIdAndUpdate(
    user._id,
    { signupChatTrialStartedAt: new Date() },
    { new: true },
  );
}

module.exports = {
  getSignupTrialSeconds,
  getSignupTrialRemainingSeconds,
  isWithinSignupTrial,
  hasPaidWalletRecharge,
  getSignupTrialStartTime,
  ensureSignupTrialStarted,
};
