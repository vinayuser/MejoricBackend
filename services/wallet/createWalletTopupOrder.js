const Razorpay = require("../../configs/razorpay");
const { getOrCreateWallet } = require("./getOrCreateWallet");
const { throwError } = require("../../utils");
const {
  isMockPaymentsEnabled,
  createMockOrderId,
} = require("../../helpers/mockPayments.helper");

exports.createWalletTopupOrder = async (userId, { amount, currency }) => {
  await getOrCreateWallet(userId);

  if (isMockPaymentsEnabled()) {
    return {
      razorpayOrderId: createMockOrderId("wallet"),
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID || "mock_key",
      mockPayments: true,
    };
  }

  const smallestUnit = currency === "INR" ? amount * 100 : amount * 100;

  const options = {
    amount: smallestUnit,
    currency,
    receipt: `wallet_topup_${userId}`,
    notes: {
      userId: userId.toString(),
      purpose: "wallet_topup",
    },
  };

  const order = await Razorpay.orders.create(options);
  if (!order) throwError(500, "Failed to create Razorpay order");

  return {
    razorpayOrderId: order.id,
    amount,
    currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    mockPayments: false,
  };
};
