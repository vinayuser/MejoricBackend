const crypto = require("crypto");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { ROLES, PLATFORMS } = require("../../constants");
const { sendResetPasswordMail } = require("../../helpers/nodeMailer");

exports.forgotPassword = async ({ email, platform, role }) => {
  email = email?.toLowerCase();
  role = role?.toLowerCase() || ROLES.USER;
  platform = platform?.toUpperCase() || PLATFORMS.WEB;
  if (!email) throwError(422, "Email is required");
  const user = await User.findOne({ email, isDeleted: false }).select(
    "+resetPasswordTokenHash +resetPasswordExpiresAt",
  );
  if (!user) throwError(404, "User not found with this email");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  let base;
  if (process.env.NODE_ENV === "production" && platform === PLATFORMS.WEB) {
    base = process.env.WEB_BASE_URL;
  } else if (
    process.env.NODE_ENV === "production" &&
    platform === PLATFORMS.ADMIN
  ) {
    base = process.env.ADMIN_BASE_URL;
  } else if (
    process.env.NODE_ENV === "production" &&
    platform === PLATFORMS.APP
  ) {
    base = process.env.APP_BASE_URL;
  } else {
    base = process.env.FRONTEND_BASE_URL;
  }
  if (!base) {
    throwError(
      500,
      "FRONTEND_BASE_URL or ADMIN_BASE_URL or APP_BASE_URL is not configured",
    );
  }
  const resetLink = `${String(base).replace(/\/$/, "")}/reset-password?token=${token}&email=${encodeURIComponent(
    email,
  )}&role=${encodeURIComponent(role)}`;

  await sendResetPasswordMail({ email, name: user?.name || "User", resetLink });
  return { message: "Reset password link sent to your email" };
};
