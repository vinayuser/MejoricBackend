const CommunityAccess = require("../../models/CommunityAccess");
const WalletTransaction = require("../../models/WalletTransaction");
const Wallet = require("../../models/Wallet");
const { getCommunityUnlockAmount } = require("../platformSettings");

exports.getUnlockAmount = getCommunityUnlockAmount;

exports.hasCommunityAccess = async (userId) => {
  if (!userId) return false;
  const access = await CommunityAccess.findOne({
    userId,
    isDeleted: false,
  }).lean();
  return Boolean(access);
};

exports.getCommunityAccess = async (userId) => {
  if (!userId) return null;
  return CommunityAccess.findOne({ userId, isDeleted: false }).lean();
};

/** Paid top-ups only — welcome signup balance has no CREDIT txn from these sources. */
exports.hasPaidWalletRecharge = async (userId) => {
  return Boolean(
    await WalletTransaction.exists({
      userId,
      type: "CREDIT",
      status: "SUCCESS",
      source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] },
    }),
  );
};

exports.canUnlockWithWallet = async (userId) => {
  const hasPaid = await exports.hasPaidWalletRecharge(userId);
  const amount = await getCommunityUnlockAmount();
  if (!hasPaid) return { ok: false, reason: "welcome_only", amount };

  const wallet = await Wallet.findOne({ userId, isDeleted: false });
  const balance = wallet?.balances?.INR ?? 0;
  if (!wallet || balance < amount) {
    return { ok: false, reason: "insufficient", balance, amount };
  }
  return { ok: true, wallet, balance, amount };
};
