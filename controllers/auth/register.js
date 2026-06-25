const User = require("../../models/User");
const Mate = require("../../models/Mate");
const Mentor = require("../../models/Mentor");
// const { validateObjectId } = require("../../utils");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError, sendTokenResponse } = require("../../utils");
const { uploadImage } = require("../../services/uploads");
const { getOrCreateWallet } = require("../../services/wallet");
// const { sendLoginOtpMail, sendSignupAgreementMail } = require("../../helpers/nodeMailer");
const { sendSignupAgreementMail } = require("../../helpers/nodeMailer");
const { sendOtpToMobile } = require("../../services/otp");

exports.register = asyncWrapper(async (req, res) => {
  let {
    name,
    email,
    password,
    cofirmPassword,
    mobile,
    agreedToTerms,
    role,
    loginType,
    fcmToken,
    // categoryId,
    bio,
    pricePerMin,
    pricePerHour,
    priceUnit,
    experience,
    specifications,
    languages,
    mentorType,
    guestId,
  } = req.body;
  const image = req.files?.image;
  if (!mobile && !email) {
    throwError(422, "Email or Mobile number any one of this is required");
  }
  email = email?.toLowerCase();
  name = name?.toLowerCase();
  bio = bio?.trim();
  role = role?.toLowerCase() || ROLES.USER;
  loginType = loginType?.toLowerCase() || LOGIN_TYPES.PASSWORD;
  const isMate = role === ROLES.MATE;
  const isMentor = role === ROLES.MENTOR;
  const hasAgreedToTerms =
    agreedToTerms === true || agreedToTerms === "true" || agreedToTerms === 1;
  if (!isMate && !isMentor && !hasAgreedToTerms) {
    throwError(
      422,
      "You must agree to the Terms and Conditions and Privacy Policy to sign up.",
    );
  }
  if (password && cofirmPassword && password !== cofirmPassword) {
    throwError(422, "Password and confirm password must be same");
  }
  if (isMate || isMentor) {
    if (typeof specifications !== "undefined") {
      const specificationsArr = Array.isArray(specifications)
        ? specifications
        : specifications.split(",");
      specifications = specificationsArr
        .filter((s) => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      specifications = [];
    }
    if (typeof languages !== "undefined") {
      const languagesArr = Array.isArray(languages)
        ? languages
        : languages.split(",");
      languages = languagesArr
        .filter((l) => typeof l === "string")
        .map((l) => l.trim())
        .filter(Boolean);
    } else {
      languages = [];
    }
  }
  if (isMate) {
    if (pricePerMin && Number(pricePerMin) <= 0) {
      throwError(422, "pricePerMin must be > 0");
    }
    if (experience && Number(experience) < 0) {
      throwError(422, "experience must be >= 0");
    }
  }
  if (isMentor) {
    const normalizedMentorType = mentorType
      ? String(mentorType).toLowerCase()
      : "";
    if (!["emotional", "professional"].includes(normalizedMentorType)) {
      throwError(422, "mentorType must be emotional or professional");
    }
    if (experience && Number(experience) < 0) {
      throwError(422, "experience must be >= 0");
    }
    mentorType = normalizedMentorType;
  }
  let user;
  if (guestId) {
    user = await User.findOne({ _id: guestId, isDeleted: false });
    // Only allow conversion of guests
    if (user && user.role !== ROLES.GUEST) {
      user = null;
    }
  }

  if (email) {
    const existingEmailUser = await User.findOne({ email, role, isDeleted: false });
    if (existingEmailUser && String(existingEmailUser._id) !== String(guestId)) {
      throwError(400, "User with this email already exists");
    }
  }
  if (mobile) {
    const existingMobileUser = await User.findOne({ mobile, role, isDeleted: false });
    if (existingMobileUser && String(existingMobileUser._id) !== String(guestId)) {
      throwError(400, "User with mobile number already exists");
    }
  }
  let imageUrl;
  if (image) imageUrl = await uploadImage(image.tempFilePath);

  const userData = {
    name,
    password,
    email,
    mobile,
    role,
    fcmToken,
    loginType,
    image: imageUrl,
    isLoggedIn: true,
    isOnline: true,
    isSignUpCompleted: true,
  };

  // Generate and send mobile OTP on signup if mobile is provided and the user is NOT a mate
  let otpSessionId = null;
  if (mobile && !isMate && !isMentor) {
    userData.isMobileVerified = false;
    userData.isEmailVerified = false;
  } else if (isMate || isMentor) {
    userData.isEmailVerified = true;
    userData.isMobileVerified = true;
  }

  if (user) {
    // Convert guest to permanent user
    Object.assign(user, userData);
    await user.save();
  } else {
    user = await User.create(userData);
  }

  if (mobile && !isMate && !isMentor) {
    try {
      const otpData = await sendOtpToMobile(mobile);
      if (otpData?.Status === "Success" && otpData?.Details) {
        otpSessionId = otpData.Details;
        user.otp = {
          sessionId: otpSessionId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        };
        await user.save();
        console.log(`📱 Mobile verification OTP sent to ${mobile}`);
      }
    } catch (otpError) {
      console.error("Error sending mobile verification OTP:", otpError);
    }
  }

  // if (email && otpCode) {
  //   try {
  //     sendLoginOtpMail(email, otpCode);
  //     console.log(`✉️ Email verification OTP sent to ${email}: ${otpCode}`);
  //   } catch (mailError) {
  //     console.error("Error sending email verification OTP:", mailError);
  //   }
  // }

  if (email && !isMate && !isMentor && hasAgreedToTerms) {
    try {
      await sendSignupAgreementMail({
        email,
        name: user.name,
        agreedAt: user.createdAt || new Date(),
      });
    } catch (mailError) {
      console.error("Error sending signup agreement email:", mailError);
    }
  }
  let responseMessage = "User registered successfully";
  if (user && !isMate && !isMentor) {
    await getOrCreateWallet(user._id);
    const welcomeRecharge = parseInt(process.env.FREE_WALLET_RECHARGE) || 100;
    responseMessage = `User registered successfully! Welcome, you received a ₹${welcomeRecharge} welcome wallet recharge.`;
  }
  if (isMate) {
    const effectivePrice =
      pricePerMin != null && pricePerMin !== ""
        ? Number(pricePerMin)
        : pricePerHour != null && pricePerHour !== ""
          ? Number(pricePerHour)
          : 12;
    await Mate.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      bio,
      pricePerMin: effectivePrice,
      priceUnit: priceUnit || "RUPEE",
      experience: experience ? Number(experience) : 0,
      specifications,
      languages,
    });
    responseMessage = "Mate registered successfully";
  }
  if (isMentor) {
    await Mentor.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      bio,
      experience: experience ? Number(experience) : 0,
      specifications,
      languages,
      mentorType,
    });
    responseMessage = "Mentor registered successfully";
  }
  return sendTokenResponse(res, 201, responseMessage, user, {
    otpSessionId,
  });
});
