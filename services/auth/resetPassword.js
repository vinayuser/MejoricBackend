const crypto = require("crypto");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.resetPassword = async ({ token, email, newPassword, role }) => {
  email = email?.toLowerCase();
  role = role?.toLowerCase() || ROLES.USER;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    email,
    role,
    isDeleted: false,
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
  }).select("+resetPasswordTokenHash +resetPasswordExpiresAt +password");

  if (!user) throwError(400, "Invalid or expired reset token");

  user.password = newPassword;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;

  await user.save();

  return { message: "Password reset successfully" };
};
