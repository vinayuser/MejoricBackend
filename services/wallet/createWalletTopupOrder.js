const Razorpay = require("../../configs/razorpay");
const { getOrCreateWallet } = require("./getOrCreateWallet");
const { throwError } = require("../../utils");

exports.createWalletTopupOrder = async (userId, { amount, currency }) => {
  const wallet = await getOrCreateWallet(userId);

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
  };
};
