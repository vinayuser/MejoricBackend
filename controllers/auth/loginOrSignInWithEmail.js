const defaultPassword = process.env.DEFAULT_PASSWORD;
const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const {
  asyncWrapper,
  sendSuccess,
  throwError,
  generateOTP,
} = require("../../utils");
// const { sendLoginOtpMail } = require("../../helpers/nodeMailer");
const { sendOtpToMobile } = require("../../services/otp");

exports.loginOrSignInWithEmail = asyncWrapper(async (req, res) => {
  let { email, role, loginType } = req.body;
  if (!email) throwError(422, "Email is required");
  email = email?.toLowerCase();
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.EMAIL;
  const updatedData = {
    code: generateOTP(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
  let isFirst = false;
  let user = await User.findOne({ email, role, isDeleted: false }).select(
    "+password +otp",
  );
  if (!user) {
    isFirst = true;
    user = await User.create({
      email,
      role,
      loginType,
      password: defaultPassword,
      otp: updatedData,
    });
  } else {
    user.otp = updatedData;
    user = await user.save();
  }
  // sendLoginOtpMail(email, updatedData.code);
  let otpData;
  if (user?.mobile) {
    otpData = await sendOtpToMobile(user.mobile);
    if (otpData?.Status === "Success" && otpData?.Details) {
      user.otp = {
        ...updatedData,
        sessionId: otpData.Details,
      };
      await user.save();
    }
  }
  return sendSuccess(
    res,
    200,
    user?.mobile
      ? "OTP has been sent to your mobile number."
      : "OTP generated. Add a mobile number to receive the code via SMS.",
    { isFirst, otpData, sessionId: otpData?.Details },
  );
});
