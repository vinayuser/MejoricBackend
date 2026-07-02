const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const ChatSession = require("../models/ChatSession");
const Wallet = require("../models/Wallet");
const Mate = require("../models/Mate");
const { sendPushNotification } = require("../helpers/notification.helper");
const { processChatBilling } = require("../helpers/chatBilling.helper");
const { throwError } = require("../utils");
const { ROLES } = require("../constants");
const {
  getSignupTrialRemainingSeconds,
  hasPaidWalletRecharge,
  ensureSignupTrialStarted,
} = require("../helpers/signupTrial.helper");

const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.userId;
    const { recipientId, text } = req.body;

    if (
      !recipientId ||
      !text ||
      !mongoose.Types.ObjectId.isValid(recipientId)
    ) {
      console.log(
        `[Server Chat] Validation failed: recipientId=${recipientId}, text=${text}`,
      );
      return throwError(400, "Valid recipientId and text are required.");
    }

    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);

    if (!sender) {
      return throwError(404, "Sender not found");
    }

    if (!recipient) {
      console.log(`[Server Chat] Recipient not found: ${recipientId}`);
      return throwError(404, "Recipient not found");
    }

    if (sender.role === ROLES.USER) {
      const refreshedSender = await ensureSignupTrialStarted(sender);
      const paidRecharge = await hasPaidWalletRecharge(senderId);
      if (!paidRecharge) {
        const trialRemaining = getSignupTrialRemainingSeconds(refreshedSender);
        if (trialRemaining <= 0) {
          return throwError(
            403,
            "Your free 10-minute signup chat period has ended. Please recharge your wallet to continue chatting.",
          );
        }
      }
    }

    // Determine deterministic conversationId for socket room
    const conversationId = [senderId.toString(), recipientId.toString()]
      .sort()
      .join("_");

    console.log(
      `[Server Chat] Attempting to create message: sender=${senderId}, recipient=${recipientId}`,
    );
    // Save to DB with explicit casting to avoid any Mongoose version issues
    const message = await Message.create({
      senderId: new mongoose.Types.ObjectId(senderId.toString()),
      senderName: sender.name || "User",
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      text,
      conversationId,
      timestamp: new Date(),
    });

    console.log(`[Server Chat] Message created successfully: ${message._id}`);

    // Update or create ChatSession atomically
    let session;
    let retries = 3;
    while (retries > 0) {
      try {
        session = await ChatSession.findOneAndUpdate(
          { conversationId, status: "ACTIVE" },
          {
            $inc: { messageCount: 1 },
            $setOnInsert: {
              senderId: new mongoose.Types.ObjectId(senderId.toString()),
              recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
              startTime: new Date(),
              status: "ACTIVE",
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
          }
        );
        console.log(`[Server Chat] Session updated/created atomically: ${session._id}, messageCount: ${session.messageCount}`);
        break;
      } catch (error) {
        if (error.code === 11000 && retries > 1) {
          retries--;
          console.log(`[Server Chat] Duplicate key error in sendMessage ChatSession upsert, retrying... (remaining: ${retries})`);
          continue;
        }
        throw error;
      }
    }

    // Heal broken session if it was created by a legacy buggy upsert (missing required fields)
    if (session && (!session.senderId || !session.recipientId)) {
      const healUpdate = {};
      if (!session.senderId) {
        healUpdate.senderId = new mongoose.Types.ObjectId(senderId.toString());
      }
      if (!session.recipientId) {
        healUpdate.recipientId = new mongoose.Types.ObjectId(recipientId.toString());
      }
      session = await ChatSession.findByIdAndUpdate(
        session._id,
        { $set: healUpdate },
        { returnDocument: "after" }
      );
      console.log(`[Server Chat] Session updated and healed: ${session._id}`);
    }

    // Socket.io delivery
    const io = req.app.get("io");
    if (io) {
      io.to(message.conversationId).emit("new_message", {
        _id: message._id,
        senderId: senderId.toString(),
        senderName: sender.name || "User",
        text,
        timestamp: message.timestamp,
        conversationId: message.conversationId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error(`[Server Chat] Error in sendMessage:`, error);
    next(error);
  }
};

const initiateChat = async (req, res, next) => {
  try {
    const senderId = req.userId;
    const { recipientId } = req.body;

    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);

    if (!recipient) return throwError(404, "Recipient not found");

    const recipientMate = await Mate.findOne({ userId: recipientId });
    if (recipientMate && !recipientMate.isAvailable) {
      return throwError(400, "Mate is offline! Please try chatting when they are online.");
    }

    if (sender.role === ROLES.USER) {
      const refreshedSender = await ensureSignupTrialStarted(sender);
      const paidRecharge = await hasPaidWalletRecharge(senderId);
      if (paidRecharge) {
        const wallet = await Wallet.findOne({ userId: senderId, isDeleted: false });
        const balance = wallet?.balances?.INR ?? 0;
        if (!wallet || balance <= 0) {
          return throwError(400, "Your wallet balance is exhausted. Please recharge to continue using chats or calls.");
        }
      } else {
        const trialRemaining = getSignupTrialRemainingSeconds(refreshedSender);
        if (trialRemaining <= 0) {
          return throwError(
            403,
            "Your free 10-minute signup chat period has ended. Please recharge your wallet to continue chatting.",
          );
        }
      }
    }

    if (sender.role === ROLES.GUEST) {
      const clientIp = sender.ipAddress;
      const guestUsersFromIp = await User.find({
        $or: [
          { _id: sender._id },
          { ipAddress: clientIp }
        ],
        role: ROLES.GUEST
      }).select("_id");
      const guestIds = guestUsersFromIp.map(u => u._id);

      const endedSessions = await ChatSession.find({
        $or: [
          { senderId: { $in: guestIds } },
          { recipientId: { $in: guestIds } }
        ],
        status: "ENDED"
      });

      let consumedSeconds = 0;
      for (const sess of endedSessions) {
        consumedSeconds += sess.duration || 0;
      }

      const totalAllowed = parseInt(process.env.TRIAL_CHAT_DURATION) || 180;
      if (consumedSeconds >= totalAllowed) {
        return throwError(403, "Your 3-minute free guest trial has been fully exhausted. Please sign up and recharge your wallet to continue chatting.");
      }
    }

    console.log(
      `[Server Chat] Chat INITIATED by ${senderId} for ${recipientId}. FCM Token present: ${!!recipient.fcmToken}`,
    );

    if (recipient.fcmToken) {
      await sendPushNotification({
        userId: recipientId,
        fcmToken: recipient.fcmToken,
        title: "New Chat Request",
        body: `${sender.name || "Someone"} wants to chat with you.`,
        type: "CHAT_INITIATED",
        data: {
          event: "CHAT_INITIATED",
          senderId: senderId.toString(),
          senderName: sender.name || "User",
          senderRole: sender.role,
        },
      });
    }

    // Real-time socket fallback
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${recipientId}`).emit("notification", {
        type: "CHAT_INITIATED",
        senderId: senderId.toString(),
        senderName: sender.name || "User",
        senderRole: sender.role,
        text: "wants to chat with you",
        timestamp: Date.now().toString(),
        senderOrigin: (
          process.env.FRONTEND_BASE_URL ||
          process.env.WEB_BASE_URL ||
          "https://mejoric.com"
        ).replace(/\/$/, ""),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chat initiated",
    });
  } catch (error) {
    next(error);
  }
};

const getChatHistory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { recipientId } = req.query;

    if (!recipientId) {
      return throwError(400, "Recipient ID is required");
    }

    // Find messages between these two users
    const messages = await Message.find({
      $or: [
        { senderId: userId, recipientId: recipientId },
        { senderId: recipientId, recipientId: userId },
      ],
    })
      .sort({ timestamp: 1 }) // Chronological order
      .limit(50); // Last 50 messages

    // Determine deterministic conversationId
    const conversationId = [userId, recipientId].sort().join("_");

    return res.status(200).json({
      success: true,
      conversationId,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

const acceptChat = async (req, res, next) => {
  try {
    const senderId = req.userId;
    const { recipientId } = req.body;

    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);

    if (!recipient) return throwError(404, "Recipient not found");

    if (recipient.fcmToken) {
      await sendPushNotification({
        userId: recipientId,
        fcmToken: recipient.fcmToken,
        title: "Chat Accepted",
        body: `${sender.name || "Mentor"} has joined the chat.`,
        type: "CHAT_ACCEPTED",
        data: {
          event: "CHAT_ACCEPTED",
          senderId: senderId.toString(),
          senderName: sender.name || "Mentor",
        },
      });
    }

    // Determine deterministic conversationId
    const conversationId = [senderId.toString(), recipientId.toString()]
      .sort()
      .join("_");

    // Ensure session is marked as ACTIVE and update participant count if needed
    // We must include senderId and recipientId in $setOnInsert because they are required in the schema
    let retries = 3;
    while (retries > 0) {
      try {
        await ChatSession.findOneAndUpdate(
          { conversationId, status: { $ne: "ENDED" } },
          {
            status: "ACTIVE",
            $setOnInsert: {
              senderId: new mongoose.Types.ObjectId(recipientId.toString()), // The User (initiator)
              recipientId: new mongoose.Types.ObjectId(senderId.toString()), // The Mate (acceptor)
              startTime: new Date(),
            },
          },
          { upsert: true, returnDocument: 'after', runValidators: true },
        );
        break;
      } catch (error) {
        if (error.code === 11000 && retries > 1) {
          retries--;
          console.log(`[Server Chat] Duplicate key error in acceptChat ChatSession upsert, retrying... (remaining: ${retries})`);
          continue;
        }
        throw error;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Chat acceptance sent",
    });
  } catch (error) {
    next(error);
  }
};

const rejectChat = async (req, res, next) => {
  try {
    const senderId = req.userId; // The mate
    const { recipientId } = req.body; // The user

    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);

    if (!recipient) return throwError(404, "Recipient not found");

    // Send FCM notification to the user
    if (recipient.fcmToken) {
      await sendPushNotification({
        userId: recipientId,
        fcmToken: recipient.fcmToken,
        title: "Chat Declined",
        body: `${sender.name || "Mate"} has declined your chat request.`,
        type: "CHAT_DECLINED",
        data: {
          event: "CHAT_DECLINED",
          senderId: senderId.toString(),
          senderName: sender.name || "Mate",
        },
      });
    }

    // Socket.io delivery
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${recipientId}`).emit("notification", {
        type: "CHAT_DECLINED",
        senderId: senderId.toString(),
        senderName: sender.name || "Mate",
      });
    }

    // Determine deterministic conversationId
    const conversationId = [senderId.toString(), recipientId.toString()]
      .sort()
      .join("_");

    // Log the rejection
    await ChatSession.create({
      senderId: recipientId,
      recipientId: senderId,
      conversationId,
      startTime: new Date(),
      endTime: new Date(),
      status: "REJECTED",
      messageCount: 0,
    });

    return res.status(200).json({
      success: true,
      message: "Chat rejection sent",
    });
  } catch (error) {
    next(error);
  }
};

const getAllChatHistory = async (req, res, next) => {
  try {
    let userId = req.userId;
    if (req.role === ROLES.ADMIN && req.query.userId) {
      userId = req.query.userId;
    }
    const { otherPartyId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {
      $or: [{ senderId: userId }, { recipientId: userId }],
    };

    if (otherPartyId) {
      query = {
        $or: [
          { senderId: userId, recipientId: otherPartyId },
          { senderId: otherPartyId, recipientId: userId },
        ],
      };
    }

    const totalSessions = await ChatSession.countDocuments(query);
    const totalPages = Math.ceil(totalSessions / limit);

    const sessions = await ChatSession.find(query)
      .populate("senderId", "name")
      .populate("recipientId", "name")
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);

    const formattedSessions = sessions.map((session) => {
      // Ensure we compare strings properly
      const currentUserIdStr = String(userId);
      const senderIdStr = String(
        session.senderId?._id || session.senderId || "",
      );
      const recipientIdStr = String(
        session.recipientId?._id || session.recipientId || "",
      );

      const isMeSender = senderIdStr === currentUserIdStr;
      const otherUser = isMeSender ? session.recipientId : session.senderId;

      return {
        id: session._id,
        otherUser: {
          _id: otherUser?._id,
          name: otherUser?.name || "Guest User",
        },
        startTime: session.startTime,
        endTime: session.endTime,
        messageCount: session.messageCount,
        status: session.status,
        conversationId: session.conversationId,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedSessions,
      pagination: {
        totalSessions,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

const endChat = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return throwError(400, "Conversation ID is required");
    }

    const {
      activeSessions,
      disconnectTimeouts,
    } = require("../helpers/chat.helper");
    const session = activeSessions.get(conversationId);

    await processChatBilling(session, conversationId);

    if (session) {
      if (session.timer) clearInterval(session.timer);
      activeSessions.delete(conversationId);
    }

    // Clear any disconnect timeout
    if (disconnectTimeouts.has(conversationId)) {
      clearTimeout(disconnectTimeouts.get(conversationId));
      disconnectTimeouts.delete(conversationId);
    }

    const user = await User.findById(userId);
    const userName = user?.name || "The other party";

    // Notify via Socket
    const io = req.app.get("io");
    if (io) {
      io.to(conversationId).emit("session_ended", {
        message: `${userName} has ended the session.`,
        endedBy: userName,
      });
    }

    // Notify via FCM
    try {
      const ids = conversationId.split("_");
      const recipientId = ids.find((id) => id !== userId.toString());
      if (recipientId) {
        const recipient = await User.findById(recipientId);
        if (recipient && recipient.fcmToken) {
          await sendPushNotification({
            userId: recipientId,
            fcmToken: recipient.fcmToken,
            title: "Chat Ended",
            body: `${userName} has ended the session.`,
            type: "CHAT_ENDED",
            data: { conversationId, endedBy: userName },
          });
        }
      }
    } catch (fcmErr) {
      console.error("Error sending endChat FCM:", fcmErr);
    }

    return res.status(200).json({
      success: true,
      message: "Chat ended successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  initiateChat,
  getChatHistory,
  getAllChatHistory,
  acceptChat,
  rejectChat,
  endChat,
};
