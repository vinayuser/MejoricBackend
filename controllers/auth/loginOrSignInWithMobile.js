const defaultPassword = process.env.DEFAULT_PASSWORD;
const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const { sendOtpToMobile } = require("../../services/otp");

exports.loginOrSignInWithMobile = asyncWrapper(async (req, res) => {
  let { mobile, role, loginType } = req.body;
  if (!mobile) throwError(422, "Mobile number is required");
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.MOBILE;
  let isFirst = false;
  let user = await User.findOne({ mobile, role, isDeleted: false }).select(
    "+password +otp",
  );
  if (!user) {
    isFirst = true;
    user = await User.create({
      mobile,
      role,
      loginType,
      password: defaultPassword,
    });
  }
  const otpData = await sendOtpToMobile(mobile);
  if (otpData?.Status === "Success" && otpData?.Details) {
    user.otp = {
      sessionId: otpData.Details,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
    await user.save();
  }
  return sendSuccess(
    res,
    200,
    "OTP has been sent to your mobile number.",
    {
      otpData,
      sessionId: otpData?.Details,
      isFirst,
    },
  );
});
