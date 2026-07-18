const CommunityAccess = require("../../models/CommunityAccess");
const Wallet = require("../../models/Wallet");
const WalletTransaction = require("../../models/WalletTransaction");
const {
  getUnlockAmount,
  getCommunityAccess,
  canUnlockWithWallet,
} = require("./accessHelpers");

exports.getAccessStatus = async (userId) => {
  const access = await getCommunityAccess(userId);
  const amount = await getUnlockAmount();
  const walletCheck = await canUnlockWithWallet(userId);
  return {
    unlocked: Boolean(access),
    unlockedAt: access?.unlockedAt || null,
    method: access?.method || null,
    unlockAmount: amount,
    canPayWithWallet: walletCheck.ok,
    walletBalance: walletCheck.balance ?? null,
  };
};

exports.unlockWithWallet = async (userId) => {
  const existing = await getCommunityAccess(userId);
  if (existing) {
    return {
      unlocked: true,
      alreadyUnlocked: true,
      access: existing,
      requiresPayment: false,
      unlockAmount: existing.amount || (await getUnlockAmount()),
    };
  }

  const check = await canUnlockWithWallet(userId);
  if (!check.ok) {
    return {
      unlocked: false,
      requiresPayment: true,
      reason: check.reason,
      unlockAmount: check.amount || (await getUnlockAmount()),
      walletBalance: check.balance ?? 0,
    };
  }

  const { wallet, amount } = check;
  const openingBalance = wallet.balances.INR || 0;
  const closingBalance = openingBalance - amount;

  if (closingBalance < 0) {
    return {
      unlocked: false,
      requiresPayment: true,
      reason: "insufficient",
      unlockAmount: amount,
      walletBalance: openingBalance,
    };
  }

  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, "balances.INR": { $gte: amount } },
    { $inc: { "balances.INR": -amount } },
    { returnDocument: "after" },
  );
  if (!updated) {
    return {
      unlocked: false,
      requiresPayment: true,
      reason: "insufficient",
      unlockAmount: amount,
      walletBalance: openingBalance,
    };
  }

  const walletTxn = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    type: "DEBIT",
    amount,
    currency: "INR",
    status: "SUCCESS",
    source: "COMMUNITY",
    description: "Community access unlock (one-time)",
    openingBalance,
    closingBalance: updated.balances.INR,
    metadata: { purpose: "COMMUNITY_UNLOCK" },
  });

  const access = await CommunityAccess.create({
    userId,
    method: "WALLET",
    amount,
    currency: "INR",
    walletTransactionId: walletTxn._id,
    unlockedAt: new Date(),
  });

  return {
    unlocked: true,
    alreadyUnlocked: false,
    requiresPayment: false,
    access,
    unlockAmount: amount,
    closingBalance: updated.balances.INR,
  };
};
