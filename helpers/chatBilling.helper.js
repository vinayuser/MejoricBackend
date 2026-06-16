const ChatSession = require("../models/ChatSession");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");

/**
 * Calculate and process chat session billing.
 * Deducts from payer's wallet and marks ChatSession as ENDED with billing info.
 *
 * @param {Object} session - Active in-memory session object
 * @param {string} conversationId - Deterministic conversation ID
 * @returns {Promise<{totalAmountDeducted: number, pricePerMin: number, finalDuration: number}>}
 */
async function processChatBilling(session, conversationId) {
  const trialDuration =
    typeof session?.trialDuration === "number"
      ? session.trialDuration
      : (parseInt(process.env.TRIAL_CHAT_DURATION) || 600);
  const pricePerMin = session?.pricePerMin || 0;

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
  const billableDuration = Math.max(0, finalDuration - trialDuration);
  let totalAmountDeducted = 0;

  if (billableDuration > 0 && pricePerMin > 0) {
    const billableMinutes = Math.ceil(billableDuration / 60);
    totalAmountDeducted = billableMinutes * pricePerMin;

    const dbSession = await ChatSession.findOne({
      conversationId,
      status: "ACTIVE",
    });
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
            const minLabel = billableMinutes === 1 ? "min" : "mins";
            const msgLabel = (dbSession.messageCount || 0) === 1 ? "message" : "messages";
            description = `Chat Session with ${otherUser.name} (${billableMinutes} ${minLabel}, ${dbSession.messageCount || 0} ${msgLabel})`;
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

        // Credit to the mate's wallet if payer has ever recharged (excludes welcome credits)
        if (dbSession) {
          const mateId = dbSession.senderId.toString() === payerId.toString() ? dbSession.recipientId : dbSession.senderId;
          const hasRecharged = await WalletTransaction.exists({
            userId: payerId,
            type: "CREDIT",
            status: "SUCCESS",
            source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] }
          });

          if (hasRecharged) {
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
              const minLabelRec = billableMinutes === 1 ? "min" : "mins";
              const chatDescriptionRec = `Earnings from Chat Session with ${payerUser?.name || "User"} (${billableMinutes} ${minLabelRec}, ${mateSharePercent}% share)`;

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
              console.log(`💰 Credited mate ${mateId} with ₹${mateAmount} (60% of ₹${totalAmountDeducted}) for chat session ${dbSession._id}`);
            }
          } else {
            console.log(`ℹ️ Payer ${payerId} has not made a paid recharge. Bypassing mate credit for free chat session.`);
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
