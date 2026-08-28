const User = require("../../models/User");
const Corporate = require("../../models/Corporate");
const { ROLES, LOGIN_TYPES, CORPORATE_ROLES } = require("../../constants");
const { throwError, generateOTP } = require("../../utils");
const { sendLoginOtpMail } = require("../../helpers/nodeMailer/sendLoginOtpMail");
const billing = require("./billing");

const defaultPassword = process.env.DEFAULT_PASSWORD;

async function getOwnerUser(userId) {
  const user = await User.findById(userId).select("corporateId corporateRole");
  if (!user?.corporateId || user.corporateRole !== CORPORATE_ROLES.OWNER) {
    throwError(403, "Corporate owner access required");
  }
  return user;
}

async function resolveCorporateForOwnerEmail(email) {
  const normalizedEmail = email?.toLowerCase()?.trim();
  if (!normalizedEmail) throwError(422, "Email is required");

  const corporate = await Corporate.findOne({
    billingContactEmail: normalizedEmail,
    isActive: true,
    isDeleted: false,
  });

  if (!corporate) {
    throwError(
      404,
      "No company admin account found for this email. Use the billing contact email registered with Mejoric.",
    );
  }

  return corporate;
}

function sanitizeOwnerDashboard(dashboard) {
  if (!dashboard?.corporate) return dashboard;
  const { adminNotes, ...corporate } = dashboard.corporate;
  return { ...dashboard, corporate };
}

exports.sendCorporateOwnerOtp = async (payload = {}) => {
  const email = payload.email?.toLowerCase()?.trim();
  const corporate = await resolveCorporateForOwnerEmail(email);

  let user = await User.findOne({ email, isDeleted: false }).select("+otp");
  if (user) {
    if (
      user.corporateId &&
      user.corporateId.toString() !== corporate._id.toString() &&
      user.corporateRole !== CORPORATE_ROLES.OWNER
    ) {
      throwError(403, "This email is registered with a different corporate account");
    }
    if (!user.corporateId && user.isSignUpCompleted && user.role !== ROLES.ADMIN) {
      throwError(
        409,
        "This email is already registered as a regular user. Please contact Mejoric support.",
      );
    }
  }

  const otpPayload = {
    code: generateOTP(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };

  if (!user) {
    user = await User.create({
      email,
      name: corporate.billingContactName || corporate.name,
      role: ROLES.USER,
      loginType: LOGIN_TYPES.EMAIL,
      password: defaultPassword,
      corporateId: corporate._id,
      corporateRole: CORPORATE_ROLES.OWNER,
      isEmailVerified: true,
      isSignUpCompleted: true,
      otp: otpPayload,
    });
  } else {
    user.corporateId = corporate._id;
    user.corporateRole = CORPORATE_ROLES.OWNER;
    user.otp = otpPayload;
    if (!user.name?.trim()) {
      user.name = corporate.billingContactName || corporate.name;
    }
    await user.save();
  }

  sendLoginOtpMail(email, otpPayload.code).catch((err) => {
    console.error("[Corporate Owner] OTP email failed:", err?.message || err);
  });

  return {
    email,
    corporateId: corporate._id,
    companyName: corporate.name,
  };
};

exports.verifyCorporateOwnerOtp = async (payload = {}) => {
  const email = payload.email?.toLowerCase()?.trim();
  const otp = payload.otp?.trim();
  if (!email) throwError(422, "Email is required");
  if (!otp) throwError(422, "OTP is required");

  const corporate = await resolveCorporateForOwnerEmail(email);

  let user = await User.findOne({ email, isDeleted: false }).select("+otp");
  if (!user) throwError(404, "User not found. Please request OTP again.");
  if (!user.otp?.code) throwError(404, "OTP not found. Please request a new code.");
  if (new Date() > user.otp.expiresAt) throwError(410, "OTP expired");
  if (user.otp.code !== otp) throwError(403, "Invalid OTP");

  user.otp = undefined;
  user.corporateId = corporate._id;
  user.corporateRole = CORPORATE_ROLES.OWNER;
  user.loginType = LOGIN_TYPES.EMAIL;
  user.isEmailVerified = true;
  user.isSignUpCompleted = true;
  user.isLoggedIn = true;
  user.isOnline = true;
  if (!user.name?.trim()) {
    user.name = corporate.billingContactName || corporate.name;
  }
  if (payload.fcmToken) user.fcmToken = payload.fcmToken;

  user = await user.save();
  return { user, corporate };
};

exports.getOwnerDashboard = async (userId) => {
  const user = await getOwnerUser(userId);
  const dashboard = await billing.getCorporateDashboard(user.corporateId);
  return sanitizeOwnerDashboard(dashboard);
};

exports.getOwnerUsageLogs = async (userId, query = {}) => {
  const user = await getOwnerUser(userId);
  return billing.listUsageLogs(user.corporateId, query);
};

exports.getOwnerMembers = async (userId, query = {}) => {
  const user = await getOwnerUser(userId);
  return billing.listMembers(user.corporateId, query);
};
