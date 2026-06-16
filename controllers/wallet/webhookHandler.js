const crypto = require("crypto");
const Razorpay = require("../../configs/razorpay");
const Wallet = require("../../models/Wallet");
const WalletTransaction = require("../../models/WalletTransaction");
const RazorpayTransaction = require("../../models/RazorpayTransaction");
const { getOrCreateWallet } = require("../../services/wallet");
const { asyncWrapper, sendSuccess } = require("../../utils");

exports.webhookHandler = asyncWrapper(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing signature" });
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== signature) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const event = req.body.event;
  const payload = req.body.payload?.payment?.entity;

  if (event === "payment.captured" && payload) {
    const razorpayPaymentId = payload.id;
    const razorpayOrderId = payload.order_id;

    const existingTxn = await WalletTransaction.findOne({
      "reference.razorpayPaymentId": razorpayPaymentId,
    });
    if (existingTxn) {
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    const rpTxn = await RazorpayTransaction.findOne({
      razorpayPaymentId,
      status: { $ne: "PAID" },
    });
    if (!rpTxn) {
      return res.status(200).json({ success: true, message: "No matching RazorpayTransaction" });
    }

    const currency = payload.currency.toUpperCase();
    const amount = Number(payload.amount) / (currency === "INR" ? 100 : 100);

    const wallet = await getOrCreateWallet(rpTxn.userId);
    const openingBalance = wallet.balances[currency] || 0;
    const closingBalance = openingBalance + amount;

    const walletTxn = await WalletTransaction.create({
      walletId: wallet._id,
      userId: rpTxn.userId,
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

    await RazorpayTransaction.updateOne(
      { _id: rpTxn._id },
      {
        $set: {
          status: "PAID",
          webhookVerified: true,
          raw: payload,
          walletTransactionId: walletTxn._id,
        },
      }
    );

    wallet.balances[currency] = closingBalance;
    await wallet.save();
  }

  return res.status(200).json({ success: true, message: "Webhook processed" });
});
