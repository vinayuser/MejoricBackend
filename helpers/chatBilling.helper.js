const ChatSession = require("../models/ChatSession");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");
const {
  getChatChargeForSeconds,
  formatChatDuration,
} = require("./chatPricing.helper");
const {
  deductCorporateMinutes,
} = require("./corporateBilling.helper");
const { logCorporateUsage } = require("../services/corporate/billing");

/**
 * Calculate and process chat session billing.
 * Deducts from payer's wallet and marks ChatSession as ENDED with billing info.
 *
 * @param {Object} session - Active in-memory session object
 * @param {string} conversationId - Deterministic conversation ID
 * @returns {Promise<{totalAmountDeducted: number, pricePerMin: number, finalDuration: number}>}
 */
async function processChatBilling(session, conversationId) {
  const pricePerMin = session?.pricePerMin || parseInt(process.env.CHAT_PRICE_PER_MIN) || 8;

  if (!session || !session.actualStartTime) {
    // Session never started — just mark as ENDED
    await ChatSession.updateMany(
      { conversationId, status: "ACTIVE" },
      { status: "ENDED", endTime: new Date() },
    );
    return { totalAmountDeducted: 0, pricePerMin, finalDuration: 0 };
  }

  const finalDuration = Math.floor(
    (new Date() - session.actualStartTime) / 1000,
  );
  const billableDuration =
    session.trialDuration > 0
      ? Math.max(0, finalDuration - session.trialDuration)
      : finalDuration;
  let totalAmountDeducted = 0;

  const effectivePrice = session.pricePerMin > 0 ? session.pricePerMin : pricePerMin;

  const dbSession = await ChatSession.findOne({
    conversationId,
    status: "ACTIVE",
  });

  if (
    session.billingMode === "corporate" &&
    billableDuration > 0 &&
    session.corporateId
  ) {
    const chatMinutes = Math.ceil(billableDuration / 60);
    const updated = await deductCorporateMinutes(session.corporateId, "chat", chatMinutes);
    if (updated) {
      await logCorporateUsage({
        corporateId: session.corporateId,
        userId: session.payerId || dbSession?.senderId,
        usageType: "chat",
        minutesUsed: chatMinutes,
        source: "chat",
        referenceId: conversationId,
        metadata: { billableDuration, messageCount: dbSession?.messageCount },
      });
    }
    totalAmountDeducted = 0;
  } else if (billableDuration > 0 && effectivePrice > 0) {
    totalAmountDeducted = getChatChargeForSeconds(
      billableDuration,
      effectivePrice,
    );

    const payerId =
      session.payerId || (dbSession ? dbSession.senderId : null);

    if (payerId && totalAmountDeducted > 0) {
      const payerWallet = await Wallet.findOneAndUpdate(
        { userId: payerId, isDeleted: false },
        { $inc: { "balances.INR": -totalAmountDeducted } },
        { returnDocument: 'after' }
      );

      if (payerWallet) {
        let closingBalance = payerWallet.balances?.INR ?? 0;
        let openingBalance = closingBalance + totalAmountDeducted;

        if (closingBalance < 0) {
          // Cap the wallet balance at 0 to prevent negative balances
          await Wallet.updateOne(
            { _id: payerWallet._id },
            { $set: { "balances.INR": 0 } }
          );
          totalAmountDeducted = Math.max(0, openingBalance);
          closingBalance = 0;
        }

        let description = "Chat Session";
        if (dbSession) {
          const otherUserId = dbSession.senderId.toString() === payerId.toString() ? dbSession.recipientId : dbSession.senderId;
          const otherUser = await User.findById(otherUserId);
          if (otherUser) {
            const durationLabel = formatChatDuration(billableDuration);
            const msgLabel = (dbSession.messageCount || 0) === 1 ? "message" : "messages";
            description = `Chat Session with ${otherUser.name} (${durationLabel}, ${dbSession.messageCount || 0} ${msgLabel})`;
          }
        }

        await WalletTransaction.create({
          walletId: payerWallet._id,
          userId: payerId,
          type: "DEBIT",
          amount: totalAmountDeducted,
          currency: "INR",
          status: "SUCCESS",
          source: "CHAT",
          description,
          openingBalance,
          closingBalance,
          metadata: {
            conversationId,
            chatSessionId: dbSession ? dbSession._id : null,
          },
        });

        // Credit mate share for any wallet-funded chat session
        if (dbSession) {
          const mateId = dbSession.senderId.toString() === payerId.toString() ? dbSession.recipientId : dbSession.senderId;

          const mateSharePercent = parseFloat(process.env.MATE_SHARE_PERCENTAGE) || 60;
          const mateAmount = Number((totalAmountDeducted * (mateSharePercent / 100)).toFixed(2));
          if (mateAmount > 0) {
              let mateWallet = await Wallet.findOne({ userId: mateId, isDeleted: false });
              if (!mateWallet) {
                mateWallet = await Wallet.create({
                  userId: mateId,
                  balances: { INR: 0 },
                });
              }
              const openingBalanceRec = mateWallet.balances?.INR ?? 0;
              const closingBalanceRec = openingBalanceRec + mateAmount;

              mateWallet.balances.INR = closingBalanceRec;
              await mateWallet.save();

              const payerUser = await User.findById(payerId);
              const durationLabelRec = formatChatDuration(billableDuration);
              const chatDescriptionRec = `Earnings from Chat Session with ${payerUser?.name || "User"} (${durationLabelRec}, ${mateSharePercent}% share)`;

              await WalletTransaction.create({
                walletId: mateWallet._id,
                userId: mateId,
                type: "CREDIT",
                amount: mateAmount,
                currency: "INR",
                status: "SUCCESS",
                source: "CHAT",
                description: chatDescriptionRec,
                openingBalance: openingBalanceRec,
                closingBalance: closingBalanceRec,
                metadata: {
                  conversationId,
                  chatSessionId: dbSession._id,
                  role: "receiver",
                },
              });
              console.log(`💰 Credited mate ${mateId} with ₹${mateAmount} (${mateSharePercent}% of ₹${totalAmountDeducted}) for chat session ${dbSession._id}`);
          }
        }
      }
    }
  }

  await ChatSession.updateMany(
    { conversationId, status: "ACTIVE" },
    {
      status: "ENDED",
      endTime: new Date(),
      duration: finalDuration,
      totalAmountDeducted,
      pricePerMin,
    },
  );

  return { totalAmountDeducted, pricePerMin, finalDuration };
}

module.exports = { processChatBilling };
