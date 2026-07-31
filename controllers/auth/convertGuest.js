const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const {
  asyncWrapper,
  sendSuccess,
  throwError,
  sendTokenResponse,
} = require("../../utils");
const { verifyOtpToMobile } = require("../../services/otp");
const { getOrCreateWallet } = require("../../services/wallet");

/**
 * In-chat guest → registered user conversion.
 * Verifies OTP, upgrades the same User._id (chat history preserved), creates wallet.
 */
exports.convertGuest = asyncWrapper(async (req, res) => {
  let {
    mobile,
    otp,
    sessionId,
    name,
    email,
    age,
    city,
    agreedToTerms,
    fcmToken,
    guestId,
  } = req.body;

  const authGuestId = req.userId;
  const targetGuestId = guestId || authGuestId;

  if (!targetGuestId) throwError(422, "Guest session is required");
  if (!mobile) throwError(422, "Mobile number is required");
  if (!otp) throwError(422, "OTP is required");
  if (!name?.trim()) throwError(422, "Name is required");
  if (!email?.trim()) throwError(422, "Email is required");
  if (age === undefined || age === null || age === "") {
    throwError(422, "Age is required");
  }
  const parsedAge = Number(age);
  if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 100) {
    throwError(422, "Age must be between 18 and 100");
  }
  if (!city?.trim()) throwError(422, "City is required");
  const hasAgreed =
    agreedToTerms === true ||
    agreedToTerms === "true" ||
    agreedToTerms === 1 ||
    agreedToTerms === "1";
  if (!hasAgreed) {
    throwError(422, "You must agree to the Terms and Privacy Policy");
  }

  mobile = String(mobile).replace(/\D/g, "");
  if (!/^\d{10}$/.test(mobile)) {
    throwError(422, "Please enter a valid 10-digit mobile number");
  }
  email = String(email).trim().toLowerCase();
  name = String(name).trim().toLowerCase();
  city = String(city).trim();

  const guest = await User.findOne({
    _id: targetGuestId,
    isDeleted: false,
  }).select("+otp");
  if (!guest || guest.role !== ROLES.GUEST) {
    throwError(404, "Guest session not found or already converted");
  }

  // Prefer OTP on guest; fall back to mobile lookup (same person)
  sessionId = sessionId || guest.otp?.sessionId;
  if (!sessionId) {
    throwError(404, "OTP session not found. Please request a new OTP.");
  }
  const isExpired = guest.otp?.expiresAt && new Date() > guest.otp.expiresAt;
  if (isExpired) throwError(410, "OTP expired. Please request a new OTP.");

  const result = await verifyOtpToMobile(sessionId, String(otp));
  if (result?.Status !== "Success") {
    throwError(400, "Invalid OTP");
  }

  const mobileTaken = await User.findOne({
    mobile: Number(mobile),
    role: ROLES.USER,
    isDeleted: false,
    _id: { $ne: guest._id },
    isSignUpCompleted: true,
  });
  if (mobileTaken) {
    throwError(400, "User with this mobile number already exists");
  }

  const emailTaken = await User.findOne({
    email,
    role: ROLES.USER,
    isDeleted: false,
    _id: { $ne: guest._id },
  });
  if (emailTaken) {
    throwError(400, "User with this email already exists");
  }

  guest.name = name;
  guest.email = email;
  guest.mobile = Number(mobile);
  guest.age = parsedAge;
  guest.city = city;
  guest.role = ROLES.USER;
  guest.loginType = LOGIN_TYPES.MOBILE;
  guest.isSignUpCompleted = true;
  guest.isMobileVerified = true;
  guest.isEmailVerified = true;
  guest.isLoggedIn = true;
  guest.isOnline = true;
  guest.signupChatTrialStartedAt = new Date();
  guest.forceSignupBeforeChat = false;
  guest.otp = undefined;
  guest.password = email;
  // Keep createdAsGuest + ipAddress for analytics / non-registered tracking history
  if (fcmToken) guest.fcmToken = fcmToken;
  await guest.save();

  await getOrCreateWallet(guest._id);
  const welcomeRecharge = parseInt(process.env.FREE_WALLET_RECHARGE, 10) || 500;

  return sendTokenResponse(
    res,
    200,
    `Account created! You received a ₹${welcomeRecharge} welcome wallet recharge.`,
    guest,
  );
});
