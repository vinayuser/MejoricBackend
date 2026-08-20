const User = require("../models/User");
const Mate = require("../models/Mate");
const Wallet = require("../models/Wallet");
const CallSession = require("../models/CallSessions");
const CallLog = require("../models/CallLogs");
const WalletTransaction = require("../models/WalletTransaction");

const {
  buildCallChannelName,
  buildAgoraSession,
  isAgoraConfigured,
} = require("../helpers/agora.helper");
const { sendPushNotification } = require("../helpers/notification.helper");
const { getUserDisplayName, resolveCallOtherPartyName } = require("../helpers/userDisplayName.helper");
const { throwError } = require("../utils");
const { ROLES } = require("../constants");
const {
  getCorporateForUser,
  getRemainingMinutes,
  deductCorporateMinutes,
} = require("../helpers/corporateBilling.helper");
const { logCorporateUsage } = require("../services/corporate/billing");

const MINIMUM_BALANCE_REQUIRED_FOR_AUDIO_CALL = parseInt(process.env.AUDIO_CALL_PRICE_PER_MIN) || 12;
const MINIMUM_BALANCE_REQUIRED_FOR_VIDEO_CALL = parseInt(process.env.VIDEO_CALL_PRICE_PER_MIN) || 15;

const initiateCall = async (req, res, next) => {
  try {
    const callerId = req.userId;
    const { receiverId, callType, deferRing = false } = req.body;

    // Block guest users from making calls
    const caller = await User.findById(callerId);
    if (caller?.role === ROLES.GUEST) {
      return throwError(
        403,
        "Guests cannot make calls. Please sign up first.",
      );
    }

    if (caller?.role === ROLES.USER && !caller?.corporateId) {
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

    let remainingMinutes = 0;
    let isCorporateCaller = Boolean(caller?.corporateId);
    let corporateAccount = null;

    if (isCorporateCaller) {
      corporateAccount = await getCorporateForUser(callerId);
      if (!corporateAccount) {
        return throwError(403, "Corporate account not found or inactive.");
      }
      const minuteType = callType === "AUDIO" ? "audio" : "video";
      const corporateRemaining = getRemainingMinutes(corporateAccount, minuteType);
      if (corporateRemaining < 1) {
        return throwError(
          400,
          `Insufficient ${minuteType} minutes remaining on your corporate plan.`,
        );
      }
      remainingMinutes = corporateRemaining;
    } else {
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
    remainingMinutes = Math.floor(wallet.balances?.INR / minimumBalanceRequired);
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
        // Clear stale busy if there is no active accepted call
        const activeAccepted = await CallSession.findOne({
          receiverId,
          callStatus: "ACCEPTED",
        }).select("_id");
        if (!activeAccepted) {
          receiverMate.isBusy = false;
          await receiverMate.save();
        } else {
          return throwError(400, "Receiver is busy! Please try calling later.");
        }
      }
    }
    // Agora RTC channel (replaces EnableX room)
    if (!isAgoraConfigured()) {
      console.warn(
        "[Calls] AGORA_APP_ID / AGORA_APP_CERTIFICATE not set — using mock tokens.",
      );
    }

    const callChargePerMin = isCorporateCaller
      ? 0
      : callType === "AUDIO"
        ? MINIMUM_BALANCE_REQUIRED_FOR_AUDIO_CALL
        : MINIMUM_BALANCE_REQUIRED_FOR_VIDEO_CALL;

    const callerDisplayName = getUserDisplayName(caller);
    const receiverDisplayName = getUserDisplayName(receiver, "Mentor");

    const callSession = await CallSession.create({
      callerId,
      receiverId,
      callType,
      callStatus: "INITIATED",
      callChargePerMin: callChargePerMin,
      callerName: caller.name?.trim() || callerDisplayName,
      callerEmail: caller.email?.trim() || "",
      receiverName: receiver.name?.trim() || receiverDisplayName,
      receiverEmail: receiver.email?.trim() || "",
    });

    const channelName = buildCallChannelName(callSession._id);
    const callerAgora = buildAgoraSession(channelName, callerId);
    console.log("[Calls] initiate Agora session", {
      callSessionId: String(callSession._id),
      channelName,
      callerUid: callerAgora.uid,
      appId: callerAgora.appId,
      tokenLen: callerAgora.token?.length,
    });

    callSession.roomId = channelName;
    callSession.tokenCaller = callerAgora.token;
    await callSession.save();
    await CallLog.create({
      callSessionId: callSession._id,
      event: "INITIATED",
      meta: { callerId, receiverId, callType, roomId: channelName, deferRing: Boolean(deferRing) },
    });

    // Only ring the mate after the caller has mic/camera + channel ready (client calls /calls/ring).
    if (!deferRing) {
      await sendPushNotification({
        userId: receiverId,
        fcmToken: receiver.fcmToken,
        title: "Incoming Call",
        body: `${callerDisplayName} is calling you.`,
        type: "CALL",
        referenceId: callSession._id,
        data: {
          callSessionId: callSession._id.toString(),
          callerId: callerId.toString(),
          callerName: callerDisplayName,
          callType: callType,
          roomId: channelName,
          provider: "agora",
        },
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${receiverId}`).emit("notification", {
          type: "INCOMING_CALL",
          callSessionId: callSession._id.toString(),
          callerId: callerId.toString(),
          callerName: callerDisplayName,
          callType: callType,
          roomId: channelName,
          provider: "agora",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: deferRing
        ? "Call session created. Ring the receiver after media is ready."
        : "Call initiated successfully",
      data: {
        callSessionId: callSession._id,
        roomId: channelName,
        channelName,
        callerToken: callerAgora.token,
        agora: callerAgora,
        callType: callType.toLowerCase(),
        remainingMinutes,
        deferredRing: Boolean(deferRing),
      },
    });
  } catch (error) {
    next(error);
  }
};

const ringCall = async (req, res, next) => {
  try {
    const callerId = req.userId;
    const { callSessionId } = req.body;
    if (!callSessionId) return throwError(400, "callSessionId is required");

    const callSession = await CallSession.findById(callSessionId).populate(
      "receiverId",
      "fcmToken name email mobile role",
    );
    if (!callSession) return throwError(404, "Call session not found");

    if (callSession.callerId.toString() !== callerId.toString()) {
      return throwError(403, "Only the caller can ring the receiver");
    }

    if (
      callSession.callStatus !== "INITIATED" &&
      callSession.callStatus !== "RINGING"
    ) {
      return throwError(
        400,
        `Cannot ring now. Current status is ${callSession.callStatus}`,
      );
    }

    // Already ringing — idempotent success
    if (callSession.callStatus === "RINGING") {
      return res.status(200).json({
        success: true,
        message: "Receiver already notified",
        data: { callSessionId: callSession._id },
      });
    }

    const receiver = callSession.receiverId;
    if (!receiver) return throwError(404, "Receiver not found");

    callSession.callStatus = "RINGING";
    await callSession.save();

    const callerDisplayName =
      callSession.callerName?.trim() ||
      getUserDisplayName(await User.findById(callerId), "User");

    await CallLog.create({
      callSessionId: callSession._id,
      event: "RINGING",
      meta: { callerId, receiverId: receiver._id },
    });

    await sendPushNotification({
      userId: receiver._id,
      fcmToken: receiver.fcmToken,
      title: "Incoming Call",
      body: `${callerDisplayName} is calling you.`,
      type: "CALL",
      referenceId: callSession._id,
      data: {
        callSessionId: callSession._id.toString(),
        callerId: callerId.toString(),
        callerName: callerDisplayName,
        callType: callSession.callType,
        roomId: callSession.roomId,
        provider: "agora",
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${receiver._id}`).emit("notification", {
        type: "INCOMING_CALL",
        callSessionId: callSession._id.toString(),
        callerId: callerId.toString(),
        callerName: callerDisplayName,
        callType: callSession.callType,
        roomId: callSession.roomId,
        provider: "agora",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Receiver notified",
      data: { callSessionId: callSession._id },
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
    const channelName = callSession.roomId;
    const receiverAgora = buildAgoraSession(channelName, receiverId);
    console.log("[Calls] accept Agora session", {
      callSessionId: String(callSession._id),
      channelName,
      receiverUid: receiverAgora.uid,
      appId: receiverAgora.appId,
      tokenLen: receiverAgora.token?.length,
    });

    callSession.callStatus = "ACCEPTED";
    callSession.tokenReceiver = receiverAgora.token;
    callSession.startTime = new Date();
    if (!callSession.receiverName?.trim()) {
      callSession.receiverName = getUserDisplayName(receiver, "Mentor");
    }
    if (!callSession.receiverEmail?.trim() && receiver.email?.trim()) {
      callSession.receiverEmail = receiver.email.trim();
    }
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
        data: { event: "ACCEPTED" },
      });
    }
    if (receiver && receiver.role == ROLES.MATE) {
      const mate = await Mate.findOne({ userId: receiverId });
      if (mate) {
        mate.isBusy = true;
        await mate.save();
      }
    }
    const callerUserId =
      callSession.callerId?._id || callSession.callerId || null;

    return res.status(200).json({
      success: true,
      message: "Call accepted",
      data: {
        roomId: channelName,
        channelName,
        receiverToken: receiverAgora.token,
        agora: receiverAgora,
        callType: callSession.callType.toLowerCase(),
        callerId: callerUserId ? String(callerUserId) : null,
        callerName:
          callSession.callerName ||
          callSession.callerId?.name ||
          null,
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
        data: {
          event: "REJECTED",
          callSessionId: callSession._id.toString(),
        },
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${callSession.callerId._id}`).emit("notification", {
        type: "CALL_ENDED",
        callSessionId: callSessionId.toString(),
        reason: "REJECTED",
      });
    }

    const mate = await Mate.findOne({ userId: receiverId });
    if (mate?.isBusy) {
      mate.isBusy = false;
      await mate.save();
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

      const callerUser = await User.findById(callSession.callerId);
      const isCorporateCall = Boolean(callerUser?.corporateId);

      if (isCorporateCall && diffMinutes > 0) {
        const minuteType =
          callSession.callType === "AUDIO" ? "audio" : "video";
        const updated = await deductCorporateMinutes(
          callerUser.corporateId,
          minuteType,
          diffMinutes,
        );
        if (!updated) {
          console.warn(
            `[Calls] Corporate minute deduction failed for caller ${callSession.callerId}`,
          );
        } else {
          await logCorporateUsage({
            corporateId: callerUser.corporateId,
            userId: callSession.callerId,
            usageType: minuteType,
            minutesUsed: diffMinutes,
            source: "call",
            referenceId: String(callSession._id),
            metadata: {
              callType: callSession.callType,
              durationSeconds: diffSeconds,
            },
          });
        }
        callSession.totalAmountDeducted = 0;
      } else if (totalAmount > 0) {
        const receiverUser = await User.findById(callSession.receiverId);

        // 1. Deduct from caller
        const callerWallet = await Wallet.findOne({ userId: callSession.callerId, isDeleted: false });
        if (callerWallet) {
          const openingBalance = callerWallet.balances?.INR ?? 0;
          const closingBalance = openingBalance - totalAmount;

          callerWallet.balances.INR = closingBalance;
          await callerWallet.save();

          const minLabel = diffMinutes === 1 ? "min" : "mins";
          const receiverLabel =
            callSession.receiverName?.trim() ||
            getUserDisplayName(receiverUser, "Mentor");
          const callDescription = `${callSession.callType === "AUDIO" ? "Audio Call" : "Video Call"} with ${receiverLabel} (${diffMinutes} ${minLabel})`;

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
            const callerLabel =
              callSession.callerName?.trim() ||
              getUserDisplayName(callerUser, "User");
            const callDescriptionRec = `${callSession.callType === "AUDIO" ? "Audio Call" : "Video Call"} with ${callerLabel} (${diffMinutes} ${minLabelRec}, ${mateSharePercent}% share)`;

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
        data: {
          event: "ENDED",
          callSessionId: callSession._id.toString(),
        },
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
      callStatus: "RINGING",
    })
      .sort({ createdAt: -1 })
      .populate("callerId", "name email");

    if (!session) {
      return res.status(200).json({ success: true, data: null });
    }

    // Ignore stale rings older than 60s
    const ageMs = Date.now() - new Date(session.createdAt).getTime();
    if (ageMs > 60000) {
      return res.status(200).json({ success: true, data: null });
    }

    const callerName =
      session.callerName?.trim() ||
      getUserDisplayName(session.callerId, "User");

    const callerUserId = session.callerId?._id || session.callerId || null;

    return res.status(200).json({
      success: true,
      data: {
        event: "RINGING",
        type: "incoming_call",
        callSessionId: session._id.toString(),
        callType: session.callType,
        roomId: session.roomId != null ? String(session.roomId) : "",
        callerId: callerUserId ? String(callerUserId) : null,
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
      .populate("callerId", "name email image")
      .populate("receiverId", "name email image")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const userIdStr = String(userId);
    const data = calls.map((call) => {
      const doc = call.toObject();
      doc.otherPartyName = resolveCallOtherPartyName(call, userIdStr);
      return doc;
    });

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
      data,
      pagination: { page, limit, total, totalMinutes },
    });
  } catch (error) {
    next(error);
  }
};

const getCallAgoraToken = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { callSessionId } = req.params;

    const callSession = await CallSession.findById(callSessionId);
    if (!callSession) return throwError(404, "Call session not found");

    const isParticipant =
      callSession.callerId.toString() === userId.toString() ||
      callSession.receiverId.toString() === userId.toString();
    if (!isParticipant) {
      return throwError(403, "You are not part of this call");
    }

    if (!["INITIATED", "RINGING", "ACCEPTED", "ONGOING"].includes(callSession.callStatus)) {
      return throwError(400, "Call is no longer active");
    }

    const channelName = callSession.roomId;
    if (!channelName) return throwError(400, "Call channel not found");

    const agora = buildAgoraSession(channelName, userId);

    return res.status(200).json({
      success: true,
      data: {
        agora,
        callType: callSession.callType.toLowerCase(),
        callSessionId: callSession._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateCall,
  ringCall,
  acceptCall,
  rejectCall,
  endCall,
  getPendingIncoming,
  getCallHistory,
  getCallAgoraToken,
};
