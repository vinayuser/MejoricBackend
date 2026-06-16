const crypto = require("crypto");
const Razorpay = require("../../configs/razorpay");
const Wallet = require("../../models/Wallet");
const WalletTransaction = require("../../models/WalletTransaction");
const RazorpayTransaction = require("../../models/RazorpayTransaction");
const { getOrCreateWallet } = require("./getOrCreateWallet");
const { throwError } = require("../../utils");

exports.verifyWalletTopup = async (userId, payload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;

  // Mock payment bypass for local development
  console.log("Verify Request:", { razorpayPaymentId, APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV });
  if (razorpayPaymentId.startsWith("mock_") && process.env.ALLOW_MOCK_PAYMENTS === "true") {
    console.log("Mock payment detected, bypassing Razorpay verification");
    const mockAmount = Number(payload.amount) || 100;
    const currency = payload.currency || "INR";

    const wallet = await getOrCreateWallet(userId);
    const openingBalance = wallet.balances[currency] || 0;
    const closingBalance = openingBalance + mockAmount;

    const walletTxn = await WalletTransaction.create({
      walletId: wallet._id,
      userId,
      type: "CREDIT",
      amount: mockAmount,
      currency,
      status: "SUCCESS",
      source: "MOCK_PAYMENT",
      openingBalance,
      closingBalance,
      reference: {
        razorpayOrderId,
        razorpayPaymentId,
      },
    });

    // Create a mock RazorpayTransaction to keep records consistent
    await RazorpayTransaction.create({
      userId,
      walletId: wallet._id,
      walletTransactionId: walletTxn._id,
      amount: mockAmount,
      amountInSmallestUnit: mockAmount * 100,
      currency,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: "mock_signature",
      status: "PAID",
      raw: { source: "MOCK_LOCAL" },
    });

    wallet.balances[currency] = closingBalance;
    await wallet.save();

    return {
      walletTransactionId: walletTxn._id,
      amount: mockAmount,
      currency,
      closingBalance,
    };
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throwError(400, "Invalid signature");
  }

  const existingTxn = await WalletTransaction.findOne({
    "reference.razorpayPaymentId": razorpayPaymentId,
  });
  if (existingTxn) {
    throwError(400, "Payment already processed");
  }

  const payment = await Razorpay.payments.fetch(razorpayPaymentId);
  if (!payment || payment.status !== "captured") {
    throwError(400, "Payment not captured");
  }

  const currency = payment.currency.toUpperCase();
  const amount = Number(payment.amount) / (currency === "INR" ? 100 : 100);

  const wallet = await getOrCreateWallet(userId);
  const openingBalance = wallet.balances[currency] || 0;
  const closingBalance = openingBalance + amount;

  const walletTxn = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    type: "CREDIT",
    amount,
    currency,
    status: "SUCCESS",
    source: "RAZORPAY",
    openingBalance,
    closingBalance,
    reference: {
      razorpayOrderId,
      razorpayPaymentId,
    },
  });

  await RazorpayTransaction.create({
    userId,
    walletId: wallet._id,
    walletTransactionId: walletTxn._id,
    amount,
    amountInSmallestUnit: Number(payment.amount),
    currency,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    status: "PAID",
    raw: payment,
  });

  wallet.balances[currency] = closingBalance;
  await wallet.save();

  return {
    walletTransactionId: walletTxn._id,
    amount,
    currency,
    closingBalance,
  };
};
