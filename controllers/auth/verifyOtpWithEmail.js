const User = require("../../models/User");
const { asyncWrapper, sendSuccess, throwError, sendTokenResponse } = require("../../utils");
const { sendOtpVerificationSuccessMail } = require("../../helpers/nodeMailer");
const { ROLES, LOGIN_TYPES } = require("../../constants");

exports.verifyOtpWithEmail = asyncWrapper(async (req, res) => {
  let { otp, email, role, fcmToken, loginType, currentScreen } = req.body;
  email = email?.toLowerCase();
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.EMAIL;
  currentScreen = currentScreen?.toUpperCase();
  let user = await User.findOne({ email, isDeleted: false }).select(
    "-password +otp",
  );
  if (!user) throwError(404, "User not found with this email");
  if (!user.otp || !user.otp.code) throwError(404, "OTP not found");
  const isExpired = new Date() > user?.otp?.expiresAt;
  if (isExpired) throwError(410, "OTP expired");
  if (user.otp.code !== otp) throwError(403, "Invalid OTP");
  user.otp = undefined;
  user.loginType = loginType;
  user.isEmailVerified = true;
  user.isLoggedIn = true;
  user.isOnline = true;
  if (currentScreen) user.currentScreen = currentScreen;
  if (fcmToken) user.fcmToken = fcmToken;
  user = await user.save();
  sendOtpVerificationSuccessMail(email);
  return sendTokenResponse(res, 200, "OTP Verification successful", user);
});
