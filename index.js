require("dotenv").config();
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 0.1, //  Capture 10% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 0.1,
});

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const fileUpload = require("express-fileupload");
const http = require("http");
const { Server } = require("socket.io");

const { mongoDb } = require("./database/mongoDb");
const { errorHandler, blockBlockedIp } = require("./middlewares");
const { throwError } = require("./utils");
const allRoutes = require("./routes");
const { startBookingReminderJob, stopBookingReminderJob } = require("./jobs/bookingReminders");
const { getIpFromSocket } = require("./helpers/clientIp");
const {
  isIpBlocked,
  refreshBlockedIpCache,
} = require("./helpers/blockedIpCache");

// Models and Constants
const User = require("./models/User");
const Wallet = require("./models/Wallet");
const Mate = require("./models/Mate");
const ChatSession = require("./models/ChatSession");
// const backfillChatSessions = require("./backfill");
const { ROLES } = require("./constants");
const {
  getCorporateForUser,
  getRemainingMinutes,
} = require("./helpers/corporateBilling.helper");
const { setIO } = require("./helpers/socket");
const {
  registerMateSocket,
  unregisterMateSocket,
} = require("./helpers/matePresence");
const {
  roomName: communityRoomName,
  watchRoomName: communityWatchRoomName,
  addPresence: addCommunityPresence,
  removePresence: removeCommunityPresence,
  removeSocketFromAll: removeCommunitySocketFromAll,
  getOnlineCount: getCommunityOnlineCount,
  getOnlineCounts: getCommunityOnlineCounts,
} = require("./helpers/communityPresence");
const CommunityMembership = require("./models/CommunityMembership");
const { createMessage: createCommunityMessage } = require("./services/communities/postsAndMessages");
const { sendPushNotification } = require("./helpers/notification.helper");

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL,
  process.env.WEB_BASE_URL,
  process.env.ADMIN_BASE_URL,
  process.env.APP_BASE_URL,
  "https://admin.mejoric.com",
  "https://admin-dev.mejoric.com",
  "https://dev.mejoric.com",
  "http://localhost:6001",
  "http://localhost:6003",
  "http://localhost:5173",
].filter(Boolean);

/** Express mount paths — nginx /staging-api/ forwards the full URI without stripping. */
const API_MOUNT_PREFIXES = (
  process.env.API_MOUNT_PREFIXES || "/mateandmentors,/staging-api/mateandmentors"
)
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const app = express();
app.set("trust proxy", true);
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
setIO(io);

const { activeSessions, disconnectTimeouts } = require("./helpers/chat.helper");
const { processChatBilling } = require("./helpers/chatBilling.helper");
const {
  getChatSecondsForBalance,
  getChatChargeForSeconds,
  getBillableMinutes,
  getTimeLeftAfterRecharge,
} = require("./helpers/chatPricing.helper");

io.on("connection", async (socket) => {
  console.log("🔌 New socket connection:", socket.id);

  try {
    const socketIp = getIpFromSocket(socket);
    if (await isIpBlocked(socketIp)) {
      console.log(`🚫 Blocked IP socket rejected: ${socketIp}`);
      socket.emit("force_logout", {
        reason: "blocked",
        message: "Your access to this platform has been blocked.",
      });
      socket.disconnect(true);
      return;
    }
    socket.clientIp = socketIp;
  } catch (err) {
    console.warn("Socket IP block check failed:", err.message);
  }

  socket.on("register_user", async (userId) => {
    if (!userId) return;

    try {
      const socketIp = socket.clientIp || getIpFromSocket(socket);
      if (await isIpBlocked(socketIp)) {
        socket.emit("force_logout", {
          reason: "blocked",
          message: "Your access to this platform has been blocked.",
        });
        socket.disconnect(true);
        return;
      }
    } catch (err) {
      console.warn("register_user IP block check failed:", err.message);
    }

    const uid = String(userId);
    socket.join(`user_${uid}`);
    socket.registeredUserId = uid;

    try {
      const registeredUser = await User.findById(uid)
        .select("role isActive")
        .lean();
      if (registeredUser?.isActive === false) {
        socket.emit("force_logout", {
          reason: "blocked",
          message: "Your access to this platform has been blocked.",
        });
        socket.disconnect(true);
        return;
      }
      if (
        registeredUser &&
        (registeredUser.role === ROLES.MATE ||
          registeredUser.role === ROLES.MENTOR)
      ) {
        socket.tracksMatePresence = true;
        registerMateSocket(uid, socket.id);
      }
    } catch (err) {
      console.error("register_user presence lookup failed:", err.message);
    }

    console.log(`📡 User ${uid} registered for private notifications`);
  });

  /** Mate asks guest to register — persist so guest cannot chat until converted */
  socket.on("ask_signup", async (payload = {}) => {
    const conversationId = payload.conversationId || socket.conversationId;
    const guestUserId = payload.guestUserId;
    const data = {
      event: "ASK_SIGNUP",
      conversationId,
      fromMate: true,
      forceSignup: true,
      message:
        payload.message ||
        "Your mate invited you to create an account to continue chatting.",
    };
    if (guestUserId && mongoose.Types.ObjectId.isValid(guestUserId)) {
      try {
        await User.updateOne(
          { _id: guestUserId, role: ROLES.GUEST, isDeleted: false },
          { $set: { forceSignupBeforeChat: true } },
        );
      } catch (err) {
        console.error("Failed to set forceSignupBeforeChat:", err.message);
      }
    }
    if (conversationId) {
      io.to(conversationId).emit("ask_signup", data);
    }
    if (guestUserId) {
      io.to(`user_${guestUserId}`).emit("ask_signup", data);
    }
  });

  socket.on("join_admin_mate_tracking", () => {
    socket.join("admin_mate_tracking");
    console.log(`📊 Admin socket ${socket.id} joined mate tracking room`);
  });

  const broadcastCommunityOnline = (communityId) => {
    const cid = String(communityId);
    const payload = {
      communityId: cid,
      online: getCommunityOnlineCount(cid),
    };
    io.to(communityRoomName(cid)).emit("community_online", payload);
    io.to(communityWatchRoomName(cid)).emit("community_online", payload);
  };

  /** Watch online counts for joined communities (sidebar). */
  socket.on("community_watch", ({ communityIds } = {}) => {
    const ids = Array.isArray(communityIds) ? communityIds.map(String) : [];
    socket.communityWatchIds = socket.communityWatchIds || new Set();
    for (const id of socket.communityWatchIds) {
      if (!ids.includes(id)) socket.leave(communityWatchRoomName(id));
    }
    socket.communityWatchIds = new Set(ids);
    for (const id of ids) {
      socket.join(communityWatchRoomName(id));
    }
    socket.emit("community_online_counts", getCommunityOnlineCounts(ids));
  });

  /** Enter a community chat room (membership required). */
  socket.on("join_community", async ({ communityId, userId } = {}) => {
    try {
      if (!communityId || !userId) return;
      const cid = String(communityId);
      const uid = String(userId);

      const member = await CommunityMembership.exists({
        userId: uid,
        communityId: cid,
        isDeleted: false,
      });
      if (!member) {
        socket.emit("community_error", {
          message: "Join this community to chat",
        });
        return;
      }

      // Leave previous community chat rooms (keep watch rooms)
      if (socket.communityChatId && socket.communityChatId !== cid) {
        const prev = socket.communityChatId;
        socket.leave(communityRoomName(prev));
        removeCommunityPresence(prev, uid, socket.id);
        broadcastCommunityOnline(prev);
      }

      socket.join(communityRoomName(cid));
      socket.communityChatId = cid;
      socket.communityUserId = uid;
      addCommunityPresence(cid, uid, socket.id);
      broadcastCommunityOnline(cid);
      console.log(`🏘️ User ${uid} joined community room ${cid}`);
    } catch (err) {
      console.error("join_community error:", err.message);
      socket.emit("community_error", { message: "Unable to join community chat" });
    }
  });

  socket.on("leave_community", ({ communityId, userId } = {}) => {
    const cid = String(communityId || socket.communityChatId || "");
    const uid = String(userId || socket.communityUserId || socket.registeredUserId || "");
    if (!cid || !uid) return;
    socket.leave(communityRoomName(cid));
    if (socket.communityChatId === cid) socket.communityChatId = null;
    removeCommunityPresence(cid, uid, socket.id);
    broadcastCommunityOnline(cid);
  });

  /** Real-time community message — persists then broadcasts to room. */
  socket.on("community_send_message", async (payload = {}) => {
    try {
      const communityId = String(payload.communityId || "");
      const userId = String(
        payload.userId || socket.communityUserId || socket.registeredUserId || "",
      );
      const text = payload.text;
      if (!communityId || !userId || !text) return;

      const message = await createCommunityMessage(userId, communityId, {
        text,
        isAnonymous: payload.isAnonymous === true,
      });

      // Broadcast without isMine — each client derives it from authorId
      const { isMine: _mine, ...publicMessage } = message;
      io.to(communityRoomName(communityId)).emit("community_new_message", {
        communityId,
        message: publicMessage,
      });
    } catch (err) {
      console.error("community_send_message error:", err.message);
      socket.emit("community_error", {
        message: err.message || "Failed to send message",
      });
    }
  });

  socket.on("join_chat", async (conversationId, userId) => {
    if (conversationId) {
      socket.join(conversationId);
      console.log(
        `👥 User ${socket.id} (${userId}) joined room: ${conversationId}`,
      );

      // Store info on socket for cleanup
      socket.conversationId = conversationId;
      socket.userId = userId?.toString();

      // Clear any pending disconnect timeout for this room
      if (disconnectTimeouts.has(conversationId)) {
        console.log(
          `♻️ User reconnected to ${conversationId}, clearing cleanup timeout.`,
        );
        clearTimeout(disconnectTimeouts.get(conversationId));
        disconnectTimeouts.delete(conversationId);
      }

      // Sync timer logic
      let session = activeSessions.get(conversationId);
      let duration = parseInt(process.env.TRIAL_CHAT_DURATION) || 600;
      let activePrice = 0;
      let sessionTrialDuration;
      let sessionPayerId;
      let sessionPayerBalance;
      let sessionCorporateId;
      let sessionBillingMode;

      // If it's a new session, calculate duration
      if (!session) {
        try {
          const ids = conversationId.split("_");
          // Find the participant who is a 'user' or 'guest' (the potential payer)
          const participants = await User.find({ _id: { $in: ids } });
          const payer = participants.find((u) => u.role === ROLES.USER || u.role === ROLES.GUEST);
          const mateUser = participants.find(
            (u) => u.role === ROLES.MATE || u.role === ROLES.MENTOR,
          );

          if (payer && mateUser) {
            const price = parseInt(process.env.CHAT_PRICE_PER_MIN) || 8;

            if (payer.role === ROLES.USER) {
              const corporateAccount = payer.corporateId
                ? await getCorporateForUser(payer._id)
                : null;

              if (corporateAccount) {
                const chatMinutesRemaining = getRemainingMinutes(
                  corporateAccount,
                  "chat",
                );
                duration = chatMinutesRemaining * 60;
                activePrice = 0;
                sessionTrialDuration = 0;
                sessionPayerId = payer._id;
                sessionPayerBalance = 0;
                sessionCorporateId = corporateAccount._id;
                sessionBillingMode = "corporate";

                console.log(
                  `[Timer] Corporate payer: ${payer.name}, chatMinutes=${chatMinutesRemaining}, duration=${duration}s`,
                );
              } else {
              const mate = await Mate.findOne({ userId: mateUser._id });
              const wallet = await Wallet.findOne({
                userId: payer._id,
                isDeleted: false,
              });

              if (mate && wallet) {
                const balance = wallet.balances?.INR || 0;
                const balanceDuration = getChatSecondsForBalance(balance, price);

                duration = balanceDuration;
                activePrice = price;
                sessionTrialDuration = 0;
                sessionPayerId = payer._id;
                sessionPayerBalance = balance;

                console.log(
                  `[Timer] Wallet payer: ${payer.name}, balance=${balance}, price=${price}/min, duration=${duration}s`,
                );
              }
              }
            } else if (payer.role === ROLES.GUEST) {
              let trialDuration = parseInt(process.env.TRIAL_CHAT_DURATION) || 180;
              const clientIp = payer.ipAddress;
              // Guest user trial logic: cumulative TRIAL_CHAT_DURATION per guest / IP origin
              const guestUsersFromIp = await User.find({
                $or: [
                  { _id: payer._id },
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

              trialDuration = Math.max(0, trialDuration - consumedSeconds);
              duration = trialDuration;

              console.log(
                `[Timer] Identified Guest Payer: ${payer.name}, IP: ${clientIp}. Consumed: ${consumedSeconds}s, trial=${trialDuration}s, total=${duration}s`,
              );
              activePrice = 0;
              sessionTrialDuration = trialDuration;
              sessionPayerId = payer._id;
              sessionPayerBalance = 0;
            }
          }
        } catch (err) {
          console.error("[Timer] Error calculating duration:", err);
        }

        // Create session but don't start timer yet
        session = {
          participants: new Set([userId?.toString()]),
          timeLeft: duration,
          started: false,
          pricePerMin: activePrice || 0,
          trialDuration: typeof sessionTrialDuration !== "undefined" ? sessionTrialDuration : 0,
          payerId: sessionPayerId || null,
          initialBalance: typeof sessionPayerBalance !== "undefined" ? sessionPayerBalance : 0,
          corporateId: sessionCorporateId || null,
          billingMode: sessionBillingMode || "wallet",
        };
        activeSessions.set(conversationId, session);

        // Notify the first joiner that we're waiting
        socket.emit("timer_sync", {
          timeLeft: duration,
          waiting: true,
          started: false,
          isTrial: false,
          elapsedSeconds: 0,
          balance: session.initialBalance,
        });
      } else {
        // Add new participant
        if (userId) session.participants.add(userId.toString());

        // If we have 2 participants, start the timer!
        if (session.participants.size >= 2 && !session.started) {
          session.started = true;
          session.actualStartTime = new Date(); // Added to track billing duration
          console.log(`⏱️ Starting timer for room: ${conversationId}`);

          session.timer = setInterval(() => {
            session.timeLeft -= 1;

            // Low balance warning — skip free signup / guest trial sessions
            if (
              session.pricePerMin > 0 &&
              (session.timeLeft === 120 || session.timeLeft === 60)
            ) {
              console.log(
                `⚠️ Low balance warning for ${conversationId}: ${session.timeLeft}s left`,
              );
              io.to(conversationId).emit("low_balance_warning", {
                timeLeft: session.timeLeft,
                message: `Your balance is about to finish. The session will end in ${Math.floor(session.timeLeft / 60)} minute(s). Please recharge.`,
              });
            }

            const elapsedSeconds = session.actualStartTime
              ? Math.floor((new Date() - session.actualStartTime) / 1000)
              : 0;
            const billableSeconds = elapsedSeconds;
            const billableMinutes = getBillableMinutes(billableSeconds);
            const currentBalance =
              session.pricePerMin > 0
                ? Math.max(
                    0,
                    session.initialBalance -
                      billableMinutes * session.pricePerMin,
                  )
                : session.initialBalance;

            io.to(conversationId).emit("timer_sync", {
              timeLeft: session.timeLeft,
              started: true,
              waiting: false,
              isTrial: false,
              elapsedSeconds,
              balance: Math.max(0, currentBalance),
            });

            if (session.timeLeft <= 0) {
              clearInterval(session.timer);

              // Billing Logic
              processChatBilling(session, conversationId).catch((err) =>
                console.error("Error billing session on timer expiry:", err),
              );

              activeSessions.delete(conversationId);
              const endedMessage =
                session.billingMode === "corporate"
                  ? "Your corporate chat minutes have been used up."
                  : session.pricePerMin > 0
                  ? "Your wallet balance has run out. Please recharge to continue chatting."
                  : "Your free guest chat time has ended. Please sign up and recharge to continue.";
              io.to(conversationId).emit("session_ended", {
                message: endedMessage,
                balanceExhausted: session.pricePerMin > 0,
              });
            }
          }, 1000);
        } else {
          // Send current state
          console.log(
            `📊 [Session] Syncing state for ${conversationId}: timeLeft=${session.timeLeft}, started=${session.started}`,
          );
          const elapsedSeconds = session.actualStartTime
            ? Math.floor((new Date() - session.actualStartTime) / 1000)
            : 0;
          const billableSeconds = elapsedSeconds;
          const billableMinutes = getBillableMinutes(billableSeconds);
          const currentBalance =
            session.pricePerMin > 0
              ? Math.max(
                  0,
                  session.initialBalance -
                    billableMinutes * session.pricePerMin,
                )
              : session.initialBalance;

          socket.emit("timer_sync", {
            timeLeft: session.timeLeft,
            started: session.started,
            waiting: !session.started,
            isTrial: false,
            elapsedSeconds,
            balance: Math.max(0, currentBalance),
          });
        }
      }
    }
  });

  socket.on("end_chat", async (conversationId, userName) => {
    if (conversationId) {
      const session = activeSessions.get(conversationId);
      if (session) {
        if (session.timer) clearInterval(session.timer);
        activeSessions.delete(conversationId);
      }

      // Clear any pending disconnect timeout for this room
      if (disconnectTimeouts.has(conversationId)) {
        clearTimeout(disconnectTimeouts.get(conversationId));
        disconnectTimeouts.delete(conversationId);
      }

      // Billing Logic
      processChatBilling(session, conversationId).catch((err) =>
        console.error("Error closing ChatSession with billing:", err),
      );

      io.to(conversationId).emit("session_ended", {
        message: `${userName || "The other party"} has ended the session.`,
        endedBy: userName || "The other party",
      });
      console.log(`🚫 Session ended by ${userName} in room: ${conversationId}`);

      // Send FCM notification to the other party as fallback
      try {
        const ids = conversationId.split("_");
        // Find recipient (the one who is NOT the sender)
        // If socket.userId is not set, we try to deduce it from the conversationId if we know who the sender is
        // but userName is usually passed.
        const recipientId = ids.find((id) => id !== socket.userId);
        if (recipientId) {
          const recipient = await User.findById(recipientId);
          if (recipient && recipient.fcmToken) {
            await sendPushNotification({
              userId: recipientId,
              fcmToken: recipient.fcmToken,
              title: "Chat Ended",
              body: `${userName || "The other party"} has ended the session.`,
              type: "CHAT_ENDED",
              data: { conversationId, endedBy: userName },
            });
          }
        }
      } catch (fcmErr) {
        console.error("Error sending session_ended FCM:", fcmErr);
      }
    }
  });

  socket.on("sync_recharge", async (conversationId) => {
    if (conversationId) {
      const session = activeSessions.get(conversationId);
      if (session && session.payerId) {
        try {
          const wallet = await Wallet.findOne({ userId: session.payerId });
          if (wallet) {
            const newBalance = wallet.balances?.INR || 0;
            const price = parseInt(process.env.CHAT_PRICE_PER_MIN) || 8;
            session.trialDuration = 0;
            session.pricePerMin = price;

            const elapsedSeconds = session.actualStartTime
              ? Math.floor((new Date() - session.actualStartTime) / 1000)
              : 0;

            const alreadyCharged = getChatChargeForSeconds(elapsedSeconds, price);
            const availableBalance = Math.max(0, newBalance - alreadyCharged);

            session.initialBalance = newBalance;
            session.timeLeft = getTimeLeftAfterRecharge(
              elapsedSeconds,
              newBalance,
              price,
            );

            console.log(`♻️ Sync recharge for payer ${session.payerId} in ${conversationId}: new balance=${newBalance}, new timeLeft=${session.timeLeft}`);

            const projectedBalance = Math.max(0, newBalance - alreadyCharged);

            io.to(conversationId).emit("timer_sync", {
              timeLeft: session.timeLeft,
              started: true,
              isTrial: false,
              elapsedSeconds,
              balance: projectedBalance,
            });

            io.to(conversationId).emit("recharge_applied", {
              balance: projectedBalance,
              timeLeft: session.timeLeft,
              message: `Recharge successful! You can continue chatting.`,
            });

            if (session.timeLeft > 0 && session.started) {
              if (session.timer) {
                clearInterval(session.timer);
                session.timer = null;
              }
              session.timer = setInterval(() => {
                session.timeLeft -= 1;
                const elapsed = session.actualStartTime
                  ? Math.floor((new Date() - session.actualStartTime) / 1000)
                  : 0;
                const billableMinutes = getBillableMinutes(elapsed);
                const currentBalance = Math.max(
                  0,
                  session.initialBalance -
                    billableMinutes * session.pricePerMin,
                );
                io.to(conversationId).emit("timer_sync", {
                  timeLeft: session.timeLeft,
                  started: true,
                  isTrial: false,
                  elapsedSeconds: elapsed,
                  balance: currentBalance,
                });
                if (session.timeLeft <= 0) {
                  clearInterval(session.timer);
                  processChatBilling(session, conversationId).catch((err) =>
                    console.error("Error billing session on timer expiry:", err),
                  );
                  activeSessions.delete(conversationId);
                  io.to(conversationId).emit("session_ended", {
                    message:
                      "Your wallet balance has run out. Please recharge to continue chatting.",
                    balanceExhausted: true,
                  });
                }
              }, 1000);
            }
          }
        } catch (err) {
          console.error("Error syncing recharge inside chat:", err);
        }
      } else if (socket.registeredUserId) {
        try {
          const wallet = await Wallet.findOne({
            userId: socket.registeredUserId,
            isDeleted: false,
          });
          if (wallet) {
            socket.emit("recharge_applied", {
              balance: wallet.balances?.INR || 0,
              timeLeft: 0,
              message:
                "Recharge successful. Close and start a new chat to continue.",
            });
          }
        } catch (err) {
          console.error("Error applying recharge after session ended:", err);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);

    if (socket.registeredUserId && socket.tracksMatePresence) {
      unregisterMateSocket(socket.registeredUserId, socket.id);
    }

    // Community presence cleanup
    const affectedCommunities = removeCommunitySocketFromAll(socket.id, [
      ...(socket.communityChatId ? [socket.communityChatId] : []),
      ...(socket.communityWatchIds || []),
    ]);
    for (const cid of affectedCommunities) {
      broadcastCommunityOnline(cid);
    }

    const { conversationId, userId } = socket;

    if (conversationId) {
      // Use a small delay to allow Socket.io to update room occupancy
      setTimeout(async () => {
        const session = activeSessions.get(conversationId);
        if (!session) return;

        const room = io.sockets.adapter.rooms.get(conversationId);
        const occupantCount = room ? room.size : 0;

        if (occupantCount === 0) {
          console.log(
            `⏳ Room ${conversationId} is empty. Setting 30s grace period after disconnect of ${userId}`,
          );

          // Clear any existing timeout for this room
          if (disconnectTimeouts.has(conversationId)) {
            clearTimeout(disconnectTimeouts.get(conversationId));
          }

          const timeout = setTimeout(async () => {
            console.log(
              `⚠️ Grace period expired. Cleaning up empty session ${conversationId}`,
            );
            if (session.timer) clearInterval(session.timer);

            // Billing Logic
            processChatBilling(session, conversationId).catch((err) =>
              console.error(
                "Error billing session on disconnect timeout:",
                err,
              ),
            );

            activeSessions.delete(conversationId);
            disconnectTimeouts.delete(conversationId);

            io.to(conversationId).emit("session_ended", {
              message: "Network failed. Please try again.",
              reason: "NETWORK_FAILURE",
            });

            // Send FCM to participants
            try {
              const ids = conversationId.split("_");
              for (const id of ids) {
                const u = await User.findById(id);
                if (u && u.fcmToken) {
                  await sendPushNotification({
                    userId: id,
                    fcmToken: u.fcmToken,
                    title: "Chat Disconnected",
                    body: "The chat session was closed due to connection loss.",
                    type: "CHAT_ENDED",
                    data: { conversationId, reason: "TIMEOUT" },
                  });
                }
              }
            } catch (err) {
              console.error("Error sending timeout FCM:", err);
            }
          }, 30000); // 30 seconds grace period

          disconnectTimeouts.set(conversationId, timeout);
        } else {
          console.log(
            `🔌 Room ${conversationId} still has ${occupantCount} occupants. Keeping session alive.`,
          );
        }
      }, 1000);
    }
  });
});

// Make io accessible in controllers
app.set("io", io);

const { zoomWebhook } = require("./controllers/bookings/zoomWebhook");
for (const apiPrefix of API_MOUNT_PREFIXES) {
  app.post(
    `${apiPrefix}/bookings/zoom/webhook`,
    express.raw({ type: "application/json" }),
    zoomWebhook,
  );
}

app.use(express.json({ limit: "1mb" }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
}));
app.use(cookieParser());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Reject blocked IPs before any API route (Cloudflare is edge; this is the app gate)
app.use(blockBlockedIp);
for (const apiPrefix of API_MOUNT_PREFIXES) {
  app.use(apiPrefix, allRoutes);
  console.log(`✅ API mounted at ${apiPrefix}`);
}

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});
app.use((req, res, next) => {
  throwError(404, "Invalid API");
});

// The Sentry error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

// MongoDb + blocked IP cache
mongoDb()
  .then(async () => {
    try {
      const count = await refreshBlockedIpCache();
      console.log(`🚫 Blocked IP cache loaded (${count} active)`);
    } catch (err) {
      console.error("Failed to load blocked IP cache:", err.message);
    }
  })
  .catch((err) => {
    console.error("Mongo init failed:", err?.message || err);
  });

const PORT =
  process.env.PORT || (process.env.APP_ENV === "local" ? 6002 : 3002);
server.listen(PORT, () => {
  console.log(`✅ Mejoric Server running on http://localhost:${PORT}`);
  startBookingReminderJob();
});

const gracefulShutdown = async (signal) => {
  console.log(`📡 [Graceful Shutdown] Received ${signal}. Starting shutdown sequence...`);

  // Set a fallback force-exit timeout to prevent the process from hanging indefinitely
  const forceExitTimeout = setTimeout(() => {
    console.error("❌ [Graceful Shutdown] Shutdown timed out. Force exiting process to release port...");
    process.exit(1);
  }, 5000);
  if (typeof forceExitTimeout.unref === "function") {
    forceExitTimeout.unref(); // Allow the event loop to exit if everything else finishes
  }

  // 1. Stop accepting new connections
  server.close(() => {
    console.log("📡 [Graceful Shutdown] HTTP server closed.");
  });

  // 2. Bill all active chat sessions
  console.log(`⏱️ [Graceful Shutdown] Billing ${activeSessions.size} active chat session(s)...`);
  const billingPromises = [];
  for (const [convId, session] of activeSessions) {
    if (session.timer) {
      clearInterval(session.timer);
    }
    billingPromises.push(
      processChatBilling(session, convId).catch((err) => {
        console.error(`❌ [Graceful Shutdown] Error billing session ${convId}:`, err);
      })
    );
  }
  await Promise.all(billingPromises);
  console.log("⏱️ [Graceful Shutdown] All active chat sessions billed.");

  // 3. Close DB connection
  stopBookingReminderJob();
  try {
    await mongoose.connection.close();
    console.log("✅ [Graceful Shutdown] MongoDB connection closed.");
  } catch (dbErr) {
    console.error("❌ [Graceful Shutdown] Error closing MongoDB connection:", dbErr);
  }

  clearTimeout(forceExitTimeout);
  console.log("👋 [Graceful Shutdown] Process exiting cleanly.");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
