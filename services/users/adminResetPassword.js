const User = require("../../models/User");
const Mentor = require("../../models/Mentor");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.adminResetPassword = async (userId, newPassword = "00000000") => {
  const user = await User.findById(userId).select("+password");
  if (!user || user.isDeleted) {
    throwError(404, "User not found");
  }

  if (user.role !== ROLES.MENTOR) {
    throwError(422, "Password reset is only supported for mentor accounts");
  }

  const mentor = await Mentor.findOne({ userId, isDeleted: false });
  if (!mentor) {
    throwError(422, "User is not registered as a mentor");
  }

  user.password = newPassword;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  return {
    message: "Password reset to default successfully",
    defaultPassword: newPassword,
  };
};
