const crypto = require("crypto");
const TherapyCohort = require("../../models/TherapyCohort");
const TherapyEnrollment = require("../../models/TherapyEnrollment");
const TherapyPayment = require("../../models/TherapyPayment");
const Wallet = require("../../models/Wallet");
const WalletTransaction = require("../../models/WalletTransaction");
const User = require("../../models/User");
const Razorpay = require("../../configs/razorpay");
const { throwError } = require("../../utils");
const {
  isMockPaymentsEnabled,
  createMockOrderId,
  isMockPaymentId,
} = require("../../helpers/mockPayments.helper");
const { hasPaidWalletRecharge } = require("../communities/accessHelpers");
const { sendTherapyEnrollmentEmail } = require("../../helpers/nodeMailer/sendTherapyEmails");
const { formatCohortPublic } = require("./cohortAdmin");

async function assertCanEnroll(userId, cohortId) {
  const existing = await TherapyEnrollment.findOne({
    userId,
    cohortId,
    isDeleted: false,
    status: { $in: ["enrolled", "waitlisted"] },
  });
  if (existing) {
    throwError(400, "You are already enrolled or waitlisted for this cohort");
  }

  const cohort = await TherapyCohort.findOne({
    _id: cohortId,
    isDeleted: false,
    isActive: true,
  });
  if (!cohort) throwError(404, "Cohort not found");
  if (cohort.status === "closed" || cohort.status === "draft") {
    throwError(400, "This cohort is not open for enrollment");
  }
  return cohort;
}

async function reserveSeatAndEnroll({
  userId,
  cohort,
  amountPaid,
  paymentMethod,
  razorpayOrderId,
  razorpayPaymentId,
  walletTransactionId,
}) {
  const updated = await TherapyCohort.findOneAndUpdate(
    {
      _id: cohort._id,
      isDeleted: false,
      $expr: { $lt: ["$takenSeats", "$totalSeats"] },
    },
    {
      $inc: { takenSeats: 1 },
      $set: {
        status: "open",
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    if (cohort.waitlistEnabled) {
      const enrollment = await TherapyEnrollment.create({
        userId,
        cohortId: cohort._id,
        status: "waitlisted",
        amountPaid: 0,
        paymentMethod: paymentMethod || "RAZORPAY",
        razorpayOrderId,
        razorpayPaymentId,
      });
      return { enrollment, waitlisted: true, cohort: updated || cohort };
    }
    throwError(409, "This cohort is full");
  }

  if (updated.takenSeats >= updated.totalSeats) {
    updated.status = "full";
    await updated.save();
  }

  const enrollment = await TherapyEnrollment.create({
    userId,
    cohortId: cohort._id,
    status: "enrolled",
    amountPaid,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    walletTransactionId,
  });

  setImmediate(async () => {
    try {
      const user = await User.findById(userId).select("name email fullName");
      if (!user?.email) return;
      const fresh = await TherapyCohort.findById(cohort._id);
      const result = await sendTherapyEnrollmentEmail({
        userEmail: user.email,
        userName: user.name || user.fullName,
        cohortTheme: fresh.theme,
        amountPaid,
        enrollmentId: enrollment._id,
        slots: fresh.slots || [],
      });
      enrollment.emailStatus = result.skipped
        ? "skipped"
        : result.success
          ? "sent"
          : "failed";
      await enrollment.save();
    } catch (err) {
      console.error("Therapy enrollment email failed:", err);
      try {
        enrollment.emailStatus = "failed";
        await enrollment.save();
      } catch {
        /* ignore */
      }
    }
  });

  return { enrollment, waitlisted: false, cohort: updated };
}

exports.listTherapyForUser = async (userId) => {
  const cohorts = await TherapyCohort.find({
    isDeleted: false,
    isActive: true,
    status: { $in: ["open", "full"] },
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  let enrollmentMap = {};
  if (userId) {
    const enrollments = await TherapyEnrollment.find({
      userId,
      isDeleted: false,
      status: { $in: ["enrolled", "waitlisted"] },
    }).lean();
    enrollmentMap = Object.fromEntries(
      enrollments.map((e) => [String(e.cohortId), e]),
    );
  }

  return {
    cohorts: cohorts.map((c) => {
      const en = enrollmentMap[String(c._id)];
      return formatCohortPublic(c, {
        enrolled: Boolean(en && en.status === "enrolled"),
        enrollmentId: en ? String(en._id) : null,
        waitlisted: Boolean(en && en.status === "waitlisted"),
      });
    }),
  };
};

exports.createTherapyOrder = async (userId, cohortId) => {
  const cohort = await assertCanEnroll(userId, cohortId);
  if (cohort.takenSeats >= cohort.totalSeats) {
    throwError(409, "This cohort is full");
  }

  const amount = cohort.price;
  const currency = "INR";

  if (isMockPaymentsEnabled()) {
    const razorpayOrderId = createMockOrderId("therapy");
    await TherapyPayment.create({
      userId,
      cohortId,
      amount,
      currency,
      razorpayOrderId,
      status: "pending",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    return {
      razorpayOrderId,
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID || "mock_key",
      mockPayments: true,
      cohortId: String(cohortId),
      purpose: "THERAPY_ENROLLMENT",
    };
  }

  const order = await Razorpay.orders.create({
    amount: amount * 100,
    currency,
    receipt: `therapy_${String(cohortId).slice(-8)}_${String(userId).slice(-6)}`.slice(
      0,
      40,
    ),
    notes: {
      userId: String(userId),
      cohortId: String(cohortId),
      purpose: "THERAPY_ENROLLMENT",
    },
  });
  if (!order) throwError(500, "Failed to create payment order");

  await TherapyPayment.create({
    userId,
    cohortId,
    amount,
    currency,
    razorpayOrderId: order.id,
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return {
    razorpayOrderId: order.id,
    amount,
    currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    mockPayments: false,
    cohortId: String(cohortId),
    purpose: "THERAPY_ENROLLMENT",
  };
};

exports.verifyTherapyPayment = async (userId, payload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throwError(422, "Payment verification fields are required");
  }

  const payment = await TherapyPayment.findOne({
    razorpayOrderId,
    userId,
    isDeleted: false,
  });
  if (!payment) throwError(404, "Payment order not found");
  if (payment.status === "paid") {
    const enrollment = await TherapyEnrollment.findOne({
      userId,
      cohortId: payment.cohortId,
      isDeleted: false,
    });
    return { alreadyProcessed: true, enrollment };
  }

  const existingEnroll = await TherapyEnrollment.findOne({
    userId,
    cohortId: payment.cohortId,
    status: "enrolled",
    isDeleted: false,
  });
  if (existingEnroll) {
    payment.status = "paid";
    payment.razorpayPaymentId = razorpayPaymentId;
    await payment.save();
    return { alreadyProcessed: true, enrollment: existingEnroll };
  }

  if (!(isMockPaymentId(razorpayPaymentId) && isMockPaymentsEnabled())) {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    if (expected !== razorpaySignature) throwError(400, "Invalid signature");

    const rpPayment = await Razorpay.payments.fetch(razorpayPaymentId);
    if (!rpPayment || !["captured", "authorized"].includes(rpPayment.status)) {
      throwError(400, "Payment not captured");
    }
  }

  const cohort = await TherapyCohort.findById(payment.cohortId);
  if (!cohort || cohort.isDeleted) throwError(404, "Cohort not found");

  const { enrollment, waitlisted, cohort: updated } = await reserveSeatAndEnroll({
    userId,
    cohort,
    amountPaid: payment.amount,
    paymentMethod: "RAZORPAY",
    razorpayOrderId,
    razorpayPaymentId,
  });

  payment.status = "paid";
  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  await payment.save();

  return {
    alreadyProcessed: false,
    waitlisted,
    enrollment,
    cohort: formatCohortPublic(updated.toObject ? updated.toObject() : updated, {
      enrolled: !waitlisted,
      enrollmentId: String(enrollment._id),
    }),
  };
};

/** Wallet pay excluding welcome credits (same rule as community unlock). */
exports.enrollWithWallet = async (userId, cohortId) => {
  const cohort = await assertCanEnroll(userId, cohortId);
  if (cohort.takenSeats >= cohort.totalSeats) {
    throwError(409, "This cohort is full");
  }

  const hasPaid = await hasPaidWalletRecharge(userId);
  if (!hasPaid) {
    return {
      enrolled: false,
      requiresPayment: true,
      reason: "welcome_only",
      price: cohort.price,
    };
  }

  const wallet = await Wallet.findOne({ userId, isDeleted: false });
  const balance = wallet?.balances?.INR ?? 0;
  if (!wallet || balance < cohort.price) {
    return {
      enrolled: false,
      requiresPayment: true,
      reason: "insufficient",
      price: cohort.price,
      walletBalance: balance,
    };
  }

  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: wallet._id, "balances.INR": { $gte: cohort.price } },
    { $inc: { "balances.INR": -cohort.price } },
    { returnDocument: "after" },
  );
  if (!updatedWallet) {
    return {
      enrolled: false,
      requiresPayment: true,
      reason: "insufficient",
      price: cohort.price,
      walletBalance: balance,
    };
  }

  const walletTxn = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    type: "DEBIT",
    amount: cohort.price,
    currency: "INR",
    status: "SUCCESS",
    source: "THERAPY",
    description: `Group therapy: ${cohort.theme}`,
    openingBalance: balance,
    closingBalance: updatedWallet.balances.INR,
    metadata: { purpose: "THERAPY_ENROLLMENT", cohortId: String(cohortId) },
  });

  try {
    const { enrollment, waitlisted, cohort: updated } = await reserveSeatAndEnroll({
      userId,
      cohort,
      amountPaid: cohort.price,
      paymentMethod: "WALLET",
      walletTransactionId: walletTxn._id,
    });
    return {
      enrolled: !waitlisted,
      waitlisted,
      requiresPayment: false,
      enrollment,
      cohort: formatCohortPublic(updated.toObject ? updated.toObject() : updated, {
        enrolled: !waitlisted,
        enrollmentId: String(enrollment._id),
      }),
      closingBalance: updatedWallet.balances.INR,
    };
  } catch (err) {
    // Refund wallet if seat reserve failed
    await Wallet.findByIdAndUpdate(wallet._id, {
      $inc: { "balances.INR": cohort.price },
    });
    throw err;
  }
};

exports.getMyEnrollments = async (userId) => {
  const enrollments = await TherapyEnrollment.find({
    userId,
    isDeleted: false,
    status: "enrolled",
  })
    .populate("cohortId")
    .sort({ createdAt: -1 })
    .lean();

  return enrollments
    .filter((e) => e.cohortId && !e.cohortId.isDeleted)
    .map((e) => ({
      enrollmentId: String(e._id),
      enrolledAt: e.createdAt,
      amountPaid: e.amountPaid,
      cohort: formatCohortPublic(e.cohortId, {
        enrolled: true,
        enrollmentId: String(e._id),
      }),
    }));
};
