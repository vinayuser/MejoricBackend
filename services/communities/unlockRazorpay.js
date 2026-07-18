const crypto = require("crypto");
const Razorpay = require("../../configs/razorpay");
const CommunityAccess = require("../../models/CommunityAccess");
const { throwError } = require("../../utils");
const {
  isMockPaymentsEnabled,
  createMockOrderId,
  isMockPaymentId,
} = require("../../helpers/mockPayments.helper");
const {
  getUnlockAmount,
  getCommunityAccess,
} = require("./accessHelpers");

exports.createCommunityUnlockOrder = async (userId) => {
  const existing = await getCommunityAccess(userId);
  if (existing) {
    throwError(400, "Community access already unlocked");
  }

  const amount = await getUnlockAmount();
  const currency = "INR";

  if (isMockPaymentsEnabled()) {
    return {
      razorpayOrderId: createMockOrderId("community"),
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID || "mock_key",
      mockPayments: true,
      purpose: "COMMUNITY_UNLOCK",
    };
  }

  const order = await Razorpay.orders.create({
    amount: amount * 100,
    currency,
    receipt: `community_unlock_${userId}`.slice(0, 40),
    notes: {
      userId: userId.toString(),
      purpose: "COMMUNITY_UNLOCK",
    },
  });
  if (!order) throwError(500, "Failed to create Razorpay order");

  return {
    razorpayOrderId: order.id,
    amount,
    currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    mockPayments: false,
    purpose: "COMMUNITY_UNLOCK",
  };
};

exports.verifyCommunityUnlockPayment = async (userId, payload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;
  const amount = await getUnlockAmount();

  const existing = await getCommunityAccess(userId);
  if (existing) {
    return {
      unlocked: true,
      alreadyUnlocked: true,
      access: existing,
    };
  }

  const paidByPayment = await CommunityAccess.findOne({
    razorpayPaymentId,
    isDeleted: false,
  });
  if (paidByPayment) {
    throwError(400, "Payment already processed");
  }

  if (isMockPaymentId(razorpayPaymentId) && isMockPaymentsEnabled()) {
    const access = await CommunityAccess.create({
      userId,
      method: "RAZORPAY",
      amount,
      currency: "INR",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: razorpaySignature || "mock_signature",
      unlockedAt: new Date(),
    });
    return { unlocked: true, alreadyUnlocked: false, access, mock: true };
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throwError(400, "Invalid signature");
  }

  const payment = await Razorpay.payments.fetch(razorpayPaymentId);
  if (!payment || !["captured", "authorized"].includes(payment.status)) {
    throwError(400, "Payment not captured");
  }

  const paidAmount = Number(payment.amount) / 100;
  if (paidAmount < amount) {
    throwError(400, "Paid amount does not match unlock price");
  }

  if (
    payment.notes?.purpose &&
    payment.notes.purpose !== "COMMUNITY_UNLOCK"
  ) {
    // Order notes may not always propagate to payment; amount check is primary.
  }

  try {
    const access = await CommunityAccess.create({
      userId,
      method: "RAZORPAY",
      amount,
      currency: "INR",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      unlockedAt: new Date(),
    });
    return { unlocked: true, alreadyUnlocked: false, access };
  } catch (err) {
    if (err?.code === 11000) {
      const again = await getCommunityAccess(userId);
      if (again) {
        return { unlocked: true, alreadyUnlocked: true, access: again };
      }
    }
    throw err;
  }
};
