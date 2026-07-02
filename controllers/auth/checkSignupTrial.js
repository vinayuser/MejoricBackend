const User = require("../../models/User");
const { ROLES } = require("../../constants");
const { asyncWrapper, sendSuccess } = require("../../utils");
const {
  getSignupTrialRemainingSeconds,
  getSignupTrialSeconds,
  hasPaidWalletRecharge,
  ensureSignupTrialStarted,
} = require("../../helpers/signupTrial.helper");

exports.checkSignupTrial = asyncWrapper(async (req, res) => {
  let user = await User.findById(req.userId).select(
    "role createdAt signupChatTrialStartedAt",
  );

  if (!user || user.role !== ROLES.USER) {
    return sendSuccess(res, 200, "Signup trial check successful", {
      isExhausted: false,
      remainingSeconds: 0,
      totalSeconds: getSignupTrialSeconds(),
      hasPaidRecharge: false,
      isWithinTrial: false,
    });
  }

  user = await ensureSignupTrialStarted(user);

  const hasPaidRecharge = await hasPaidWalletRecharge(user._id);
  const remainingSeconds = getSignupTrialRemainingSeconds(user);
  const isExhausted = !hasPaidRecharge && remainingSeconds <= 0;

  return sendSuccess(res, 200, "Signup trial check successful", {
    isExhausted,
    remainingSeconds,
    totalSeconds: getSignupTrialSeconds(),
    hasPaidRecharge,
    isWithinTrial: !hasPaidRecharge && remainingSeconds > 0,
  });
});
