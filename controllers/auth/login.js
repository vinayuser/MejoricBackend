const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const {
  asyncWrapper,
  sendSuccess,
  throwError,
  sendTokenResponse,
} = require("../../utils");

exports.login = asyncWrapper(async (req, res) => {
  let { email, password, role, fcmToken, type, loginType, mobile } = req.body;
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.PASSWORD;
  let user;
  if (type === LOGIN_TYPES.EMAIL) {
    if (!email) throwError(422, "Email is required");
    email = email?.toLowerCase();
    // First, find the user by email regardless of role to give better error feedback
    user = await User.findOne({ email, isDeleted: false }).select("+password");

    if (!user) {
      throwError(404, "User not found with this email");
    }

    // Check if roles match
    if (user.role !== role) {
      throwError(
        403,
        `Please select correct role. You are registered as a ${user.role}.`,
      );
    }
  } else {
    if (!mobile) throwError(422, "Mobile number is required");
    // Find by mobile regardless of role
    user = await User.findOne({ mobile, isDeleted: false }).select("+password");

    if (!user) {
      throwError(404, "User not found with this mobile number");
    }

    // Check if roles match
    if (user.role !== role) {
      throwError(
        403,
        `Please select correct role. You are registered as a ${user.role}.`,
      );
    }
  }
  const passwordMatch = await user.matchPassword(password);
  if (!passwordMatch) throwError(401, "Wrong password");
  if (fcmToken) user.fcmToken = fcmToken;
  user = await user.save();
  return sendTokenResponse(res, 200, "User logged in successfully", user);
});
