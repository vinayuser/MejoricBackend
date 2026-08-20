const Corporate = require("../../models/Corporate");
const CorporateInvoice = require("../../models/CorporateInvoice");
const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { throwError, generateOTP } = require("../../utils");
const { sendLoginOtpMail } = require("../../helpers/nodeMailer/sendLoginOtpMail");
const {
  normalizeEmailDomain,
  emailMatchesCorporateDomain,
  getCorporateUsageSummary,
  getCorporateForUser,
} = require("../../helpers/corporateBilling.helper");
const billing = require("./billing");

const defaultPassword = process.env.DEFAULT_PASSWORD;

function applyBillingFields(corporate, payload) {
  if (payload.billingContactName != null) {
    corporate.billingContactName = payload.billingContactName?.trim() || "";
  }
  if (payload.billingContactEmail != null) {
    corporate.billingContactEmail = payload.billingContactEmail?.trim()?.toLowerCase() || "";
  }
  if (payload.billingContactPhone != null) {
    corporate.billingContactPhone = payload.billingContactPhone?.trim() || "";
  }
  if (payload.gstNumber != null) corporate.gstNumber = payload.gstNumber?.trim() || "";
  if (payload.billingAddress != null) {
    corporate.billingAddress = payload.billingAddress?.trim() || "";
  }
  if (payload.monthlyPlatformFee != null) {
    corporate.monthlyPlatformFee = Math.max(0, Number(payload.monthlyPlatformFee) || 0);
  }
  if (payload.billingCycle) corporate.billingCycle = payload.billingCycle;
  if (payload.contractStartDate) {
    corporate.contractStartDate = new Date(payload.contractStartDate);
  }
  if (payload.contractEndDate) {
    corporate.contractEndDate = new Date(payload.contractEndDate);
  }
  if (payload.paymentTermsDays != null) {
    corporate.paymentTermsDays = Math.max(0, parseInt(payload.paymentTermsDays, 10) || 15);
  }
  if (payload.setupFee != null) {
    corporate.setupFee = Math.max(0, Number(payload.setupFee) || 0);
  }
  if (payload.adminNotes != null) corporate.adminNotes = payload.adminNotes?.trim() || "";
  if (typeof payload.autoRenewInvoice === "boolean") {
    corporate.autoRenewInvoice = payload.autoRenewInvoice;
  }
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(baseSlug, excludeId) {
  let slug = baseSlug || "corporate";
  let suffix = 0;
  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug;
    const query = { slug: candidate, isDeleted: false };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Corporate.exists(query);
    if (!exists) return candidate;
    suffix += 1;
  }
}

async function getCorporateById(id) {
  const corporate = await Corporate.findOne({ _id: id, isDeleted: false });
  if (!corporate) throwError(404, "Corporate account not found");
  return corporate;
}

exports.createCorporate = async (payload = {}) => {
  const name = payload.name?.trim();
  const emailDomain = normalizeEmailDomain(payload.emailDomain);
  if (!name) throwError(422, "Company name is required");
  if (!emailDomain) throwError(422, "Email domain is required");

  const slug = await ensureUniqueSlug(slugify(name));
  const corporate = await Corporate.create({
    name,
    slug,
    emailDomain,
    audioMinutesTotal: Number(payload.audioMinutesTotal) || 0,
    videoMinutesTotal: Number(payload.videoMinutesTotal) || 0,
    chatMinutesTotal: Number(payload.chatMinutesTotal) || 0,
    isActive: payload.isActive !== false,
    monthlyPlatformFee: Math.max(0, Number(payload.monthlyPlatformFee) || 0),
    billingCycle: payload.billingCycle || "monthly",
    paymentTermsDays: parseInt(payload.paymentTermsDays, 10) || 15,
    setupFee: Math.max(0, Number(payload.setupFee) || 0),
    contractStartDate: payload.contractStartDate
      ? new Date(payload.contractStartDate)
      : new Date(),
    contractEndDate: payload.contractEndDate
      ? new Date(payload.contractEndDate)
      : undefined,
    billingContactName: payload.billingContactName?.trim() || "",
    billingContactEmail: payload.billingContactEmail?.trim()?.toLowerCase() || "",
    billingContactPhone: payload.billingContactPhone?.trim() || "",
    gstNumber: payload.gstNumber?.trim() || "",
    billingAddress: payload.billingAddress?.trim() || "",
    adminNotes: payload.adminNotes?.trim() || "",
    autoRenewInvoice: payload.autoRenewInvoice !== false,
  });

  if (payload.generateInitialInvoice !== false) {
    await billing.createInitialInvoices(corporate);
  }

  return corporate;
};

exports.updateCorporate = async (id, payload = {}) => {
  const corporate = await getCorporateById(id);
  if (payload.name?.trim()) corporate.name = payload.name.trim();
  if (payload.emailDomain) {
    corporate.emailDomain = normalizeEmailDomain(payload.emailDomain);
  }
  if (payload.audioMinutesTotal != null) {
    corporate.audioMinutesTotal = Math.max(0, Number(payload.audioMinutesTotal) || 0);
  }
  if (payload.videoMinutesTotal != null) {
    corporate.videoMinutesTotal = Math.max(0, Number(payload.videoMinutesTotal) || 0);
  }
  if (payload.chatMinutesTotal != null) {
    corporate.chatMinutesTotal = Math.max(0, Number(payload.chatMinutesTotal) || 0);
  }
  if (typeof payload.isActive === "boolean") corporate.isActive = payload.isActive;
  if (payload.name?.trim()) {
    corporate.slug = await ensureUniqueSlug(slugify(payload.name), corporate._id);
  }
  applyBillingFields(corporate, payload);
  await corporate.save();
  return corporate;
};

exports.deleteCorporate = async (id) => {
  const corporate = await getCorporateById(id);
  corporate.isDeleted = true;
  corporate.isActive = false;
  await corporate.save();
  return { id: corporate._id };
};

exports.getCorporateAdmin = async (id) => {
  const corporate = await getCorporateById(id);
  const memberCount = await User.countDocuments({
    corporateId: corporate._id,
    isDeleted: false,
  });
  return { ...corporate.toObject(), memberCount };
};

exports.listCorporatesAdmin = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const filter = { isDeleted: false };
  if (query.search?.trim()) {
    const search = query.search.trim();
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { emailDomain: { $regex: search, $options: "i" } },
    ];
  }
  const [data, total] = await Promise.all([
    Corporate.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Corporate.countDocuments(filter),
  ]);
  const ids = data.map((c) => c._id);
  const counts = await User.aggregate([
    { $match: { corporateId: { $in: ids }, isDeleted: false } },
    { $group: { _id: "$corporateId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const enriched = await Promise.all(
    data.map(async (c) => {
      const openInvoices = await CorporateInvoice.find({
        corporateId: c._id,
        isDeleted: false,
        status: { $in: ["pending", "partially_paid", "overdue"] },
      }).lean();
      const outstanding = openInvoices.reduce(
        (sum, inv) =>
          sum + Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)),
        0,
      );
      return {
        ...c,
        memberCount: countMap[String(c._id)] || 0,
        audioMinutesRemaining: Math.max(
          0,
          (c.audioMinutesTotal || 0) - (c.audioMinutesUsed || 0),
        ),
        videoMinutesRemaining: Math.max(
          0,
          (c.videoMinutesTotal || 0) - (c.videoMinutesUsed || 0),
        ),
        chatMinutesRemaining: Math.max(
          0,
          (c.chatMinutesTotal || 0) - (c.chatMinutesUsed || 0),
        ),
        outstandingBalance: Math.round(outstanding * 100) / 100,
        hasOverdue: openInvoices.some((i) => i.status === "overdue"),
      };
    }),
  );
  return {
    data: enriched,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

exports.listActiveCorporatesPublic = async () => {
  const corporates = await Corporate.find({ isActive: true, isDeleted: false })
    .select("name slug emailDomain")
    .sort({ name: 1 })
    .lean();
  return corporates;
};

exports.getMyCorporateUsage = async (userId) => {
  const corporate = await getCorporateForUser(userId);
  if (!corporate) throwError(404, "No corporate account linked to this user");
  return getCorporateUsageSummary(corporate);
};

exports.sendCorporateOtp = async (payload = {}) => {
  const corporateId = payload.corporateId;
  const email = payload.email?.toLowerCase()?.trim();
  if (!corporateId) throwError(422, "Please select a company");
  if (!email) throwError(422, "Email is required");

  const corporate = await Corporate.findOne({
    _id: corporateId,
    isActive: true,
    isDeleted: false,
  });
  if (!corporate) throwError(404, "Company not found or inactive");

  if (!emailMatchesCorporateDomain(email, corporate.emailDomain)) {
    throwError(
      403,
      `Email must belong to @${corporate.emailDomain} to register with ${corporate.name}`,
    );
  }

  let user = await User.findOne({ email, isDeleted: false }).select("+password +otp");
  if (user) {
    if (user.corporateId && user.corporateId.toString() !== corporateId.toString()) {
      throwError(403, "This email is registered with a different corporate account");
    }
    if (!user.corporateId && user.isSignUpCompleted) {
      throwError(
        409,
        "This email is already registered as a regular user. Please use the standard login.",
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
      role: ROLES.USER,
      loginType: LOGIN_TYPES.EMAIL,
      password: defaultPassword,
      corporateId: corporate._id,
      otp: otpPayload,
    });
  } else {
    user.corporateId = corporate._id;
    user.otp = otpPayload;
    if (payload.name?.trim()) user.name = payload.name.trim();
    if (payload.age != null && payload.age !== "") {
      const age = parseInt(payload.age, 10);
      if (age >= 18 && age <= 100) user.age = age;
    }
    if (payload.city?.trim()) user.city = payload.city.trim();
    await user.save();
  }

  try {
    await sendLoginOtpMail(email, otpPayload.code);
  } catch (err) {
    console.error("[Corporate] OTP email failed:", err?.message || err);
    throwError(
      502,
      "Could not send OTP email. Please try again in a moment.",
    );
  }

  return {
    isFirst: !user.isSignUpCompleted,
    email,
    corporateId: corporate._id,
    companyName: corporate.name,
  };
};

exports.verifyCorporateOtp = async (payload = {}) => {
  const corporateId = payload.corporateId;
  const email = payload.email?.toLowerCase()?.trim();
  const otp = payload.otp?.trim();
  if (!corporateId) throwError(422, "Please select a company");
  if (!email) throwError(422, "Email is required");
  if (!otp) throwError(422, "OTP is required");

  const corporate = await Corporate.findOne({
    _id: corporateId,
    isActive: true,
    isDeleted: false,
  });
  if (!corporate) throwError(404, "Company not found or inactive");

  if (!emailMatchesCorporateDomain(email, corporate.emailDomain)) {
    throwError(403, `Email must belong to @${corporate.emailDomain}`);
  }

  let user = await User.findOne({ email, isDeleted: false }).select("+otp");
  if (!user) throwError(404, "User not found. Please request OTP again.");
  if (!user.otp?.code) throwError(404, "OTP not found. Please request a new code.");
  if (new Date() > user.otp.expiresAt) throwError(410, "OTP expired");
  if (user.otp.code !== otp) throwError(403, "Invalid OTP");

  const isNewSignup = !user.isSignUpCompleted;
  if (isNewSignup) {
    const name = payload.name?.trim();
    const age = parseInt(payload.age, 10);
    const city = payload.city?.trim();
    if (!name) throwError(422, "Name is required");
    if (!city) throwError(422, "City is required");
    if (!age || age < 18 || age > 100) throwError(422, "Age must be between 18 and 100");
    user.name = name;
    user.age = age;
    user.city = city;
  }

  user.otp = undefined;
  user.corporateId = corporate._id;
  user.loginType = LOGIN_TYPES.EMAIL;
  user.isEmailVerified = true;
  user.isSignUpCompleted = true;
  user.isLoggedIn = true;
  user.isOnline = true;
  if (payload.fcmToken) user.fcmToken = payload.fcmToken;
  if (payload.currentScreen) user.currentScreen = payload.currentScreen.toUpperCase();

  user = await user.save();
  return user;
};

exports.getBillingOverview = billing.getBillingOverview;
exports.getCorporateDashboard = billing.getCorporateDashboard;
exports.listInvoices = billing.listInvoices;
exports.generateInvoice = billing.generateInvoice;
exports.recordPayment = billing.recordPayment;
exports.listUsageLogs = billing.listUsageLogs;
exports.listMembers = billing.listMembers;
exports.cancelInvoice = billing.cancelInvoice;
