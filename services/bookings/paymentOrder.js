const crypto = require("crypto");
const Razorpay = require("../../configs/razorpay");
const MentorBookingPayment = require("../../models/MentorBookingPayment");
const MentorBooking = require("../../models/MentorBooking");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { createBooking, formatBookingResponse } = require("./index");
const {
  getMentorSessionPrice,
  getMentorSessionDuration,
  isValidSessionFormat,
} = require("../../helpers/mentorPricing");
const Mentor = require("../../models/Mentor");
const MentorAvailability = require("../../models/MentorAvailability");
const { ROLES } = require("../../constants");
const {
  isMockPaymentsEnabled,
  isMockPaymentId,
  createMockOrderId,
} = require("../../helpers/mockPayments.helper");
const {
  slotIdToDate,
  slotIdToLabel,
} = require("../../helpers/bookingSlots");

const ORDER_TTL_MS = 30 * 60 * 1000;

async function validateBookingPayload(payload) {
  const {
    mentorId,
    slotLabel,
    dateKey,
    slotId,
    sessionFormat,
    guestDetails,
  } = payload;

  if (!mentorId || !dateKey || !slotId || !guestDetails) {
    throwError(422, "Incomplete booking details");
  }

  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    throwError(404, "Mentor not found");
  }

  const availability = await MentorAvailability.findOne({
    mentorId,
    dateKey,
    isDeleted: false,
  });
  if (!availability || !availability.slotIds.includes(slotId)) {
    throwError(422, "Selected slot is not available");
  }

  // Always derive IST wall-clock from slotId — never trust client scheduledAt
  const startTime = slotIdToDate(dateKey, slotId);
  if (!startTime || Number.isNaN(startTime.getTime()) || startTime <= new Date()) {
    throwError(422, "Please select a future time slot");
  }

  const taken = await MentorBooking.findOne({
    mentorId,
    slotId,
    isDeleted: false,
    status: { $nin: ["cancelled", "no_show"] },
  });
  if (taken) {
    throwError(409, "This time slot is no longer available");
  }

  const mentorProfile = await Mentor.findOne({ userId: mentorId, isDeleted: false });
  if (!mentorProfile) throwError(404, "Mentor profile not found");

  const normalizedFormat = isValidSessionFormat(sessionFormat)
    ? sessionFormat
    : "video";

  return {
    mentorId,
    scheduledAt: startTime,
    slotLabel: slotIdToLabel(dateKey, slotId) || slotLabel,
    dateKey,
    slotId,
    sessionFormat: normalizedFormat,
    sessionPrice: getMentorSessionPrice(mentorProfile, normalizedFormat),
    durationMinutes: getMentorSessionDuration(normalizedFormat),
    guestDetails,
  };
}

exports.createBookingPaymentOrder = async (userId, payload) => {
  const bookingInput = await validateBookingPayload(payload);

  await MentorBookingPayment.updateMany(
    {
      userId,
      mentorId: bookingInput.mentorId,
      slotId: bookingInput.slotId,
      status: "pending",
      isDeleted: false,
    },
    { $set: { status: "expired" } },
  );

  const amountPaise = Math.round(bookingInput.sessionPrice * 100);
  if (amountPaise < 100) {
    throwError(422, "Session amount must be at least ₹1");
  }

  const useMock = isMockPaymentsEnabled();
  let orderId;

  if (useMock) {
    orderId = createMockOrderId("mb");
  } else {
    const receipt = `mb_${String(userId).slice(-10)}_${Date.now().toString(36)}`;

    let order;
    try {
      order = await Razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          userId: String(userId),
          mentorId: String(bookingInput.mentorId),
          purpose: "mentor_booking",
        },
      });
    } catch (err) {
      const description =
        err?.error?.description || err?.message || "Failed to create Razorpay order";
      throwError(400, description);
    }

    if (!order?.id) {
      throwError(500, "Failed to create Razorpay order");
    }
    orderId = order.id;
  }

  const paymentRecord = await MentorBookingPayment.create({
    userId,
    mentorId: bookingInput.mentorId,
    scheduledAt: bookingInput.scheduledAt,
    slotLabel: bookingInput.slotLabel,
    dateKey: bookingInput.dateKey,
    slotId: bookingInput.slotId,
    sessionFormat: bookingInput.sessionFormat,
    sessionPrice: bookingInput.sessionPrice,
    durationMinutes: bookingInput.durationMinutes,
    guestDetails: bookingInput.guestDetails,
    razorpayOrderId: orderId,
    expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    status: "pending",
  });

  return {
    razorpayOrderId: orderId,
    amount: bookingInput.sessionPrice,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID || "mock_key",
    paymentRecordId: paymentRecord._id,
    mockPayments: useMock,
  };
};

exports.verifyBookingPaymentAndCreate = async (userId, payload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;

  const paymentRecord = await MentorBookingPayment.findOne({
    razorpayOrderId,
    userId,
    isDeleted: false,
  });

  if (!paymentRecord) {
    throwError(404, "Booking payment not found");
  }

  if (paymentRecord.status === "completed" && paymentRecord.bookingId) {
    const existing = await MentorBooking.findById(paymentRecord.bookingId);
    if (existing) {
      const mentor = await User.findById(existing.mentorId);
      return {
        booking: formatBookingResponse(existing, mentor),
        alreadyProcessed: true,
      };
    }
  }

  if (paymentRecord.status !== "pending") {
    throwError(400, "This payment order is no longer valid");
  }

  if (paymentRecord.expiresAt && paymentRecord.expiresAt < new Date()) {
    paymentRecord.status = "expired";
    await paymentRecord.save();
    throwError(400, "Payment order expired. Please try booking again.");
  }

  const duplicatePayment = await MentorBooking.findOne({
    razorpayPaymentId,
    isDeleted: false,
  });
  if (duplicatePayment) {
    throwError(400, "Payment already processed");
  }

  const isMock = isMockPaymentId(razorpayPaymentId) && isMockPaymentsEnabled();

  if (!isMock) {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      paymentRecord.status = "failed";
      await paymentRecord.save();
      throwError(400, "Invalid payment signature");
    }

    const payment = await Razorpay.payments.fetch(razorpayPaymentId);
    if (!payment || payment.status !== "captured") {
      paymentRecord.status = "failed";
      await paymentRecord.save();
      throwError(400, "Payment not captured");
    }

    const paidAmount = Number(payment.amount) / 100;
    if (Math.abs(paidAmount - paymentRecord.sessionPrice) > 1) {
      throwError(400, "Payment amount mismatch");
    }
  }

  const bookingResult = await createBooking({
    mentorId: paymentRecord.mentorId,
    scheduledAt: paymentRecord.scheduledAt.toISOString(),
    slotLabel: paymentRecord.slotLabel,
    dateKey: paymentRecord.dateKey,
    slotId: paymentRecord.slotId,
    guestDetails: paymentRecord.guestDetails,
    userId,
    sessionFormat: paymentRecord.sessionFormat,
    paymentStatus: "paid",
    razorpayOrderId,
    razorpayPaymentId,
  });

  paymentRecord.status = "completed";
  paymentRecord.razorpayPaymentId = razorpayPaymentId;
  paymentRecord.bookingId = bookingResult.id;
  await paymentRecord.save();

  return { booking: bookingResult, alreadyProcessed: false };
};
