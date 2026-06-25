const User = require("../models/User");
const Mate = require("../models/Mate");
const Wallet = require("../models/Wallet");
const CallSession = require("../models/CallSessions");
const CallLog = require("../models/CallLogs");
const WalletTransaction = require("../models/WalletTransaction");

const { buildChannelName, createRtcToken, getAgoraAppId, allocateCallAgoraUids } = require("../helpers/agora.helper");
const { sendPushNotification } = require("../helpers/notification.helper");
const { throwError } = require("../utils");
const { ROLES } = require("../constants");

const MINIMUM_BALANCE_REQUIRED_FOR_AUDIO_CALL = parseInt(process.env.AUDIO_CALL_PRICE_PER_MIN) || 12;
const MINIMUM_BALANCE_REQUIRED_FOR_VIDEO_CALL = parseInt(process.env.VIDEO_CALL_PRICE_PER_MIN) || 15;

const initiateCall = async (req, res, next) => {
  try {
    const callerId = req.userId;
    const { receiverId, callType } = req.body;

    // Block guest users from making calls
    const caller = await User.findById(callerId);
    if (caller?.role === ROLES.GUEST) {
      return throwError(
        403,
        "Guests cannot make calls. Please sign up first.",
      );
    }

    if (caller?.role === ROLES.USER) {
      const WalletTransaction = require("../models/WalletTransaction");
      const hasRecharged = await WalletTransaction.exists({
        userId: callerId,
        type: "CREDIT",
        status: "SUCCESS",
        source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] }
      });
      if (!hasRecharged && callType !== "AUDIO") {
        return throwError(
          400,
          "Free welcome credits can only be used for audio calls. Please recharge your wallet to make a video call."
        );
      }
    }

    // Must match GET /wallet (getWallet): only active wallets count toward balance.
    const wallet = await Wallet.findOne({
      userId: callerId,
      isDeleted: false,
    });
    const minimumBalanceRequired =
      callType === "AUDIO"
        ? MINIMUM_BALANCE_REQUIRED_FOR_AUDIO_CALL
        : MINIMUM_BALANCE_REQUIRED_FOR_VIDEO_CALL;
    const inr = wallet?.balances?.INR ?? 0;
    if (!wallet) {
      return throwError(
        400,
        "No active wallet found for your account. Open the wallet page once or contact support.",
      );
    }
    if (inr < minimumBalanceRequired) {
      return throwError(
        400,
        `Minimum wallet balance of ${minimumBalanceRequired} Rs is required to initiate a call.`,
      );
    }
    const receiver = await User.findById(receiverId);
    if (!receiver) return throwError(404, "Receiver not found");
    const receiverMate = await Mate.findOne({ userId: receiverId });
    if (!receiverMate) {
      return throwError(
        404,
        "Receiver is not a mate or mentor! Receiver cannot be called.",
      );
    }
    if (receiverMate) {
      if (!receiverMate.isAvailable) {
        return throwError(400, "Receiver is offline! Please try calling when they are online.");
      }
      if (receiverMate.isBusy) {
        return throwError(400, "Receiver is busy! Please try calling later.");
      }
    }
    // Agora RTC channel + per-session UIDs (unique per call, avoids UID_CONFLICT)
    const channelName = buildChannelName(callerId, receiverId);
    const roomId = channelName;
    let remainingMinutes = 0;
    if (callType == "AUDIO") {
      remainingMinutes = Math.floor(
        wallet.balances?.INR / minimumBalanceRequired,
      );
    } else {
      remainingMinutes = Math.floor(
        wallet.balances?.INR / minimumBalanceRequired,
      );
    }

    const callSession = await CallSession.create({
      callerId,
      receiverId,
      callType,
      callStatus: "INITIATED",
      roomId,
      callChargePerMin: minimumBalanceRequired,
    });

    const { callerUid, receiverUid } = allocateCallAgoraUids(callSession._id);
    const callerToken = createRtcToken(channelName, callerUid);
    callSession.agoraCallerUid = callerUid;
    callSession.agoraReceiverUid = receiverUid;
    callSession.tokenCaller = callerToken;
    await callSession.save();

    await CallLog.create({
      callSessionId: callSession._id,
      event: "INITIATED",
      meta: { callerId, receiverId, callType, roomId },
    });
    // Push Notification to Receiver
    // They will get the callSessionId which they will use to accept/reject
    await sendPushNotification({
      userId: receiverId,
      fcmToken: receiver.fcmToken,
      title: "Incoming Call",
      body: `${caller.name || "Someone"} is calling you.`,
      type: "CALL",
      referenceId: callSession._id,
      data: {
        callSessionId: callSession._id.toString(),
        callerName: caller.name || "Someone",
        callType: callType,
        roomId: roomId,
      },
    });

    // Real-time socket fallback
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${receiverId}`).emit("notification", {
        type: "INCOMING_CALL",
        callSessionId: callSession._id.toString(),
        callerName: caller.name || "Someone",
        callType: callType,
        roomId: roomId,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Call initiated successfully",
      data: {
        callSessionId: callSession._id,
        roomId,
        channel: roomId,
        callerToken,
        agoraAppId: getAgoraAppId(),
        uid: callerUid,
        remainingMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

const acceptCall = async (req, res, next) => {
  try {
    const receiverId = req.userId;
    const { callSessionId } = req.body;
    const receiver = await User.findById(receiverId);
    if (!receiver) return throwError(404, "Receiver not found");
    const callSession =
      await CallSession.findById(callSessionId).populate("callerId");
    if (!callSession) return throwError(404, "Call Session not found");
    if (callSession?.receiverId?.toString() !== receiverId?.toString()) {
      return throwError(403, "You are not authorized to accept this call");
    }
    if (
      callSession.callStatus !== "INITIATED" &&
      callSession.callStatus !== "RINGING"
    ) {
      return throwError(
        400,
        `Call cannot be accepted. Current status is ${callSession.callStatus}`,
      );
    }
    const { callerUid, receiverUid } =
      callSession.agoraCallerUid && callSession.agoraReceiverUid
        ? {
            callerUid: callSession.agoraCallerUid,
            receiverUid: callSession.agoraReceiverUid,
          }
        : allocateCallAgoraUids(callSession._id);

    if (!callSession.agoraCallerUid || !callSession.agoraReceiverUid) {
      callSession.agoraCallerUid = callerUid;
      callSession.agoraReceiverUid = receiverUid;
    }

    const receiverToken = createRtcToken(callSession.roomId, receiverUid);
    callSession.callStatus = "ACCEPTED";
    callSession.tokenReceiver = receiverToken;
    callSession.startTime = new Date();
    await callSession.save();
    await CallLog.create({
      callSessionId: callSession._id,
      event: "ACCEPTED",
      meta: { receiverId },
    });
    // Notify caller that call is accepted
    // Caller FCM could be handled if required
    if (callSession.callerId.fcmToken) {
      await sendPushNotification({
        userId: callSession.callerId._id,
        fcmToken: callSession.callerId.fcmToken,
        title: "Call Accepted",
        body: "Receiver has accepted the call",
        type: "CALL",
        referenceId: callSession._id,
        data: {
          event: "ACCEPTED",
          callSessionId: callSession._id.toString(),
          callStartedAt: callSession.startTime.toISOString(),
        },
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${callSession.callerId._id}`).emit("notification", {
        type: "CALL_ACCEPTED",
        callSessionId: callSession._id.toString(),
        callStartedAt: callSession.startTime.toISOString(),
      });
    }
    if (receiver && receiver.role == ROLES.MATE) {
      const mate = await Mate.findOne({ userId: receiverId });
      if (mate) {
        mate.isBusy = true;
        await mate.save();
      }
    }
    return res.status(200).json({
      success: true,
      message: "Call accepted",
      data: {
        roomId: callSession.roomId,
        channel: callSession.roomId,
        receiverToken,
        agoraAppId: getAgoraAppId(),
        uid: receiverUid,
        callStartedAt: callSession.startTime.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const rejectCall = async (req, res, next) => {
  try {
    const receiverId = req.userId;
    const { callSessionId } = req.body;

    const callSession =
      await CallSession.findById(callSessionId).populate("callerId");
    if (!callSession) return throwError(404, "Call Session not found");

    if (callSession.receiverId.toString() !== receiverId.toString()) {
      return throwError(403, "You are not authorized to reject this call");
    }

    if (
      callSession.callStatus !== "INITIATED" &&
      callSession.callStatus !== "RINGING"
    ) {
      return throwError(400, "Call cannot be rejected now");
    }

    callSession.callStatus = "REJECTED";
    callSession.endTime = new Date();
    await callSession.save();

    await CallLog.create({
      callSessionId: callSession._id,
      event: "REJECTED",
    });

    // Notify Caller
    if (callSession.callerId.fcmToken) {
      await sendPushNotification({
        userId: callSession.callerId._id,
        fcmToken: callSession.callerId.fcmToken,
        title: "Call Rejected",
        body: "User rejected the call",
        type: "CALL",
        referenceId: callSession._id,
        data: { event: "REJECTED" },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Call rejected successfully",
    });
  } catch (error) {
    next(error);
  }
};

const endCall = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { callSessionId } = req.body;
    const user = await User.findById(userId);
    if (!user) return throwError(404, "User not found");

    const callSession = await CallSession.findById(callSessionId);
    if (!callSession) return throwError(404, "Call session not found");

    if (callSession.callStatus === "ENDED") {
      return res
        .status(200)
        .json({ success: true, message: "Call already ended" });
    }

    callSession.callStatus = "ENDED";
    callSession.endedBy = userId;
    callSession.endTime = new Date();

    // Duration and deduction logic
    if (callSession.startTime) {
      const diffSeconds = Math.floor(
        (callSession.endTime - callSession.startTime) / 1000,
      );
      callSession.duration = diffSeconds;

      const diffMinutes = Math.ceil(diffSeconds / 60);
      const totalAmount = diffMinutes * callSession.callChargePerMin;
      callSession.totalAmountDeducted = totalAmount;

      // Deduct from caller and credit to receiver
      if (totalAmount > 0) {
        const callerUser = await User.findById(callSession.callerId);
        const receiverUser = await User.findById(callSession.receiverId);

        // 1. Deduct from caller
        const callerWallet = await Wallet.findOne({ userId: callSession.callerId, isDeleted: false });
        if (callerWallet) {
          const openingBalance = callerWallet.balances?.INR ?? 0;
          const closingBalance = openingBalance - totalAmount;

          callerWallet.balances.INR = closingBalance;
          await callerWallet.save();

          const minLabel = diffMinutes === 1 ? "min" : "mins";
          const callDescription = `${callSession.callType === "AUDIO" ? "Audio Call" : "Video Call"} with ${receiverUser?.name || "Mentor"} (${diffMinutes} ${minLabel})`;

          await WalletTransaction.create({
            walletId: callerWallet._id,
            userId: callSession.callerId,
            type: "DEBIT",
            amount: totalAmount,
            currency: "INR",
            status: "SUCCESS",
            source: "CALL",
            description: callDescription,
            openingBalance,
            closingBalance,
            metadata: {
              callSessionId: callSession._id,
              callType: callSession.callType,
              role: "caller",
            },
          });
        } else {
          await Wallet.findOneAndUpdate(
            { userId: callSession.callerId },
            { $inc: { "balances.INR": -totalAmount } },
          );
        }

        // 2. Credit to receiver (Mate) - only if caller has ever recharged (excludes free welcome credits)
        const hasRecharged = await WalletTransaction.exists({
          userId: callSession.callerId,
          type: "CREDIT",
          status: "SUCCESS",
          source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] }
        });

        if (hasRecharged) {
          const mateSharePercent = parseFloat(process.env.MATE_SHARE_PERCENTAGE) || 60;
          const mateAmount = Number((totalAmount * (mateSharePercent / 100)).toFixed(2));
          if (mateAmount > 0) {
            let receiverWallet = await Wallet.findOne({ userId: callSession.receiverId, isDeleted: false });
            if (!receiverWallet) {
              receiverWallet = await Wallet.create({
                userId: callSession.receiverId,
                balances: { INR: 0 },
              });
            }
            const openingBalanceRec = receiverWallet.balances?.INR ?? 0;
            const closingBalanceRec = openingBalanceRec + mateAmount;

            receiverWallet.balances.INR = closingBalanceRec;
            await receiverWallet.save();

            const minLabelRec = diffMinutes === 1 ? "min" : "mins";
            const callDescriptionRec = `${callSession.callType === "AUDIO" ? "Audio Call" : "Video Call"} with ${callerUser?.name || "User"} (${diffMinutes} ${minLabelRec}, ${mateSharePercent}% share)`;

            await WalletTransaction.create({
              walletId: receiverWallet._id,
              userId: callSession.receiverId,
              type: "CREDIT",
              amount: mateAmount,
              currency: "INR",
              status: "SUCCESS",
              source: "CALL",
              description: callDescriptionRec,
              openingBalance: openingBalanceRec,
              closingBalance: closingBalanceRec,
              metadata: {
                callSessionId: callSession._id,
                callType: callSession.callType,
                role: "receiver",
              },
            });
            console.log(`💰 Credited mate ${callSession.receiverId} with ₹${mateAmount} (60% of ₹${totalAmount}) for call session ${callSession._id}`);
          }
        } else {
          console.log(`ℹ️ Caller ${callSession.callerId} has not made a paid recharge. Bypassing mate credit for free call session.`);
        }
      }
    }
    await callSession.save();
    await CallLog.create({
      callSessionId: callSession._id,
      event: "ENDED",
      meta: {
        endedBy: userId,
        duration: callSession.duration,
        amount: callSession.totalAmountDeducted,
      },
    });
    // Notify the other party if needed
    const otherPartyId =
      callSession.callerId.toString() === userId.toString()
        ? callSession.receiverId
        : callSession.callerId;
    const otherPartyUser = await User.findById(otherPartyId);
    if (!otherPartyUser) return throwError(404, "Other party user not found");
    if (otherPartyUser && otherPartyUser.fcmToken) {
      await sendPushNotification({
        userId: otherPartyId,
        fcmToken: otherPartyUser.fcmToken,
        title: "Call Ended",
        body: "The call was ended",
        type: "CALL",
        referenceId: callSession._id,
        data: { event: "ENDED" },
      });
    }

    // Real-time socket fallback
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${otherPartyId}`).emit("notification", {
        type: "CALL_ENDED",
        callSessionId: callSessionId.toString(),
      });
    }

    if (user.role == ROLES.MATE) {
      const mate = await Mate.findOne({ userId: user._id });
      if (mate) {
        mate.isBusy = false;
        await mate.save();
      }
    } else if (otherPartyUser.role == ROLES.MATE) {
      const mate = await Mate.findOne({ userId: otherPartyUser._id });
      if (mate) {
        mate.isBusy = false;
        await mate.save();
      }
    }
    return res.status(200).json({
      success: true,
      message: "Call ended successfully",
      data: {
        duration: callSession.duration,
        totalAmountDeducted: callSession.totalAmountDeducted,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lightweight poll for receivers when Web Push / FCM is unavailable (e.g. iOS Chrome).
 * Returns the newest ringing session for this user, if any.
 */
const getPendingIncoming = async (req, res, next) => {
  try {
    const userId = req.userId;
    const session = await CallSession.findOne({
      receiverId: userId,
      callStatus: { $in: ["INITIATED", "RINGING"] },
    })
      .sort({ createdAt: -1 })
      .populate("callerId", "name");

    if (!session) {
      return res.status(200).json({ success: true, data: null });
    }

    const callerName = session.callerId?.name || "Someone";

    return res.status(200).json({
      success: true,
      data: {
        event: "RINGING",
        type: "incoming_call",
        callSessionId: session._id.toString(),
        callType: session.callType,
        roomId: session.roomId != null ? String(session.roomId) : "",
        callerName,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCallHistory = async (req, res, next) => {
  try {
    let userId = req.userId;
    if (req.role === ROLES.ADMIN && req.query.userId) {
      userId = req.query.userId;
    }
    const { otherPartyId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let query = {
      $or: [{ callerId: userId }, { receiverId: userId }],
    };

    if (otherPartyId) {
      query = {
        $or: [
          { callerId: userId, receiverId: otherPartyId },
          { callerId: otherPartyId, receiverId: userId },
        ],
      };
    }

    const calls = await CallSession.find(query)
      .populate("callerId", "name image")
      .populate("receiverId", "name image")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Calculate global stats for all calls matching the query
    const stats = await CallSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMinutes: {
            $sum: { $ceil: { $divide: [{ $ifNull: ["$duration", 0] }, 60] } },
          },
          totalCalls: { $sum: 1 },
        },
      },
    ]);

    const total = stats[0]?.totalCalls || 0;
    const totalMinutes = stats[0]?.totalMinutes || 0;

    return res.status(200).json({
      success: true,
      message: "Call history fetched",
      data: calls,
      pagination: { page, limit, total, totalMinutes },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getPendingIncoming,
  getCallHistory,
};
