const defaultPassword = process.env.DEFAULT_PASSWORD;
const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const { sendOtpToMobile } = require("../../services/otp");

exports.loginOrSignInWithMobile = asyncWrapper(async (req, res) => {
  let {
    mobile,
    role,
    loginType,
    name,
    email,
    age,
    city,
    guestId,
    fcmToken,
  } = req.body;

  if (!mobile) throwError(422, "Mobile number is required");

  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.MOBILE;

  const isUserSignup = role === ROLES.USER;
  const hasProfileFields = Boolean(
    name?.trim() ||
      email?.trim() ||
      city?.trim() ||
      (age !== undefined && age !== null && age !== ""),
  );

  if (isUserSignup && hasProfileFields) {
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
  }

  email = email?.trim()?.toLowerCase();
  name = name?.trim()?.toLowerCase();
  city = city?.trim();

  const profileFields = {};
  if (name) profileFields.name = name;
  if (email) profileFields.email = email;
  if (age !== undefined && age !== null && age !== "") {
    profileFields.age = Number(age);
  }
  if (city) profileFields.city = city;
  if (fcmToken) profileFields.fcmToken = fcmToken;

  let isFirst = false;
  let user = null;

  if (guestId) {
    user = await User.findOne({ _id: guestId, isDeleted: false }).select(
      "+password +otp",
    );
    if (user && user.role !== ROLES.GUEST) {
      user = null;
    }
  }

  if (!user) {
    user = await User.findOne({ mobile, role, isDeleted: false }).select(
      "+password +otp",
    );
  }

  if (!user) {
    if (email) {
      const emailExists = await User.findOne({
        email,
        role,
        isDeleted: false,
      });
      if (emailExists) {
        throwError(400, "User with this email already exists");
      }
    }

    isFirst = true;
    user = await User.create({
      mobile: Number(mobile),
      role,
      loginType,
      password: email || defaultPassword,
      isSignUpCompleted: false,
      ...profileFields,
    });
  } else {
    if (email && email !== user.email) {
      const emailExists = await User.findOne({
        email,
        role,
        isDeleted: false,
        _id: { $ne: user._id },
      });
      if (emailExists) {
        throwError(400, "User with this email already exists");
      }
    }

    if (Object.keys(profileFields).length) {
      Object.assign(user, profileFields);
      if (email && !user.password) {
        user.password = email;
      }
      await user.save();
    }
  }

  const otpData = await sendOtpToMobile(mobile);
  if (otpData?.Status === "Success" && otpData?.Details) {
    user.otp = {
      sessionId: otpData.Details,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
    await user.save();
  }

  return sendSuccess(res, 200, "OTP has been sent to your mobile number.", {
    otpData,
    sessionId: otpData?.Details,
    isFirst,
  });
});
