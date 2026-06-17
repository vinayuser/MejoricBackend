const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError, sendTokenResponse } = require("../../utils");
const { verifyOtpToMobile } = require("../../services/otp");

exports.verifyOtpWithMobile = asyncWrapper(async (req, res) => {
  let { sessionId, otp, mobile, role, fcmToken, loginType, currentScreen } =
    req.body;
  if (!otp || !mobile) {
    throwError(422, "Mobile number and OTP are required");
  }
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.MOBILE;
  currentScreen = currentScreen?.toUpperCase();
  let user = await User.findOne({ mobile, isDeleted: false }).select(
    "-password +otp",
  );
  if (!user) throwError(404, "User not found with this mobile number");
  sessionId = sessionId || user?.otp?.sessionId;
  if (!sessionId) throwError(404, "OTP session not found. Please request a new OTP.");
  const isExpired = user?.otp?.expiresAt && new Date() > user.otp.expiresAt;
  if (isExpired) throwError(410, "OTP expired");
  let result = await verifyOtpToMobile(sessionId, otp);
  if (result?.Status == "Success") {
    user.otp = undefined;
    user.loginType = loginType;
    user.isMobileVerified = true;
    user.isEmailVerified = true;
    user.isLoggedIn = true;
    user.isOnline = true;
    if (currentScreen) user.currentScreen = currentScreen;
    if (fcmToken) user.fcmToken = fcmToken;
    user = await user.save();
    return sendTokenResponse(res, 200, "OTP Verification successful", user);
  } else {
    return res.status(400).json({ success: false, msg: "Invalid OTP" });
  }
});
