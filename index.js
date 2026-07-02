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
const { errorHandler } = require("./middlewares");
const { throwError } = require("./utils");
const allRoutes = require("./routes");
const { startBookingReminderJob, stopBookingReminderJob } = require("./jobs/bookingReminders");

// Models and Constants
const User = require("./models/User");
const Wallet = require("./models/Wallet");
const Mate = require("./models/Mate");
const ChatSession = require("./models/ChatSession");
// const backfillChatSessions = require("./backfill");
const { ROLES } = require("./constants");
const { sendPushNotification } = require("./helpers/notification.helper");

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL,
  process.env.WEB_BASE_URL,
  process.env.ADMIN_BASE_URL,
  process.env.APP_BASE_URL,
  "http://localhost:6001",
  "http://localhost:6003",
  "http://localhost:5173",
].filter(Boolean);

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const { activeSessions, disconnectTimeouts } = require("./helpers/chat.helper");
const { processChatBilling } = require("./helpers/chatBilling.helper");
const {
  getSignupTrialRemainingSeconds,
  hasPaidWalletRecharge,
  ensureSignupTrialStarted,
} = require("./helpers/signupTrial.helper");

io.on("connection", (socket) => {
  console.log("🔌 New socket connection:", socket.id);

  socket.on("register_user", (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`📡 User ${userId} registered for private notifications`);
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

      // If it's a new session, calculate duration
      if (!session) {
        try {
          const ids = conversationId.split("_");
          // Find the participant who is a 'user' or 'guest' (the potential payer)
          const participants = await User.find({ _id: { $in: ids } });
          let payer = participants.find((u) => u.role === ROLES.USER || u.role === ROLES.GUEST);
          const mateUser = participants.find(
            (u) => u.role === ROLES.MATE || u.role === ROLES.MENTOR,
          );

          if (payer?.role === ROLES.USER) {
            payer = await ensureSignupTrialStarted(payer);
          }

          if (payer && mateUser) {
            let trialDuration = parseInt(process.env.TRIAL_CHAT_DURATION) || 180;

            if (payer.role === ROLES.USER) {
              const mate = await Mate.findOne({ userId: mateUser._id });
              const wallet = await Wallet.findOne({ userId: payer._id });
              const paidRecharge = await hasPaidWalletRecharge(payer._id);

              if (mate && wallet) {
                const balance = wallet.balances?.INR || 0;
                const price = parseInt(process.env.CHAT_PRICE_PER_MIN) || 8;

                if (!paidRecharge) {
                  // New signup: chat only for remaining wall-clock trial (default 10 min)
                  const signupRemaining = getSignupTrialRemainingSeconds(payer);
                  trialDuration = signupRemaining;
                  duration = signupRemaining;
                  activePrice = 0;
                  sessionTrialDuration = signupRemaining;
                  sessionPayerId = payer._id;
                  sessionPayerBalance = balance;

                  console.log(
                    `[Timer] Signup trial payer: ${payer.name}, remaining=${signupRemaining}s`,
                  );
                } else {
                  // Paid users: optional first-session trial + wallet balance
                  const previousSessions = await ChatSession.countDocuments({
                    $or: [{ senderId: payer._id }, { recipientId: payer._id }],
                    status: "ENDED",
                  });
                  if (previousSessions > 0) {
                    trialDuration = 0;
                  }

                  const balanceDuration = Math.floor(balance / price) * 60;
                  duration = trialDuration + balanceDuration;

                  console.log(
                    `[Timer] Identified User Payer: ${payer.name}, Mate: ${mateUser.name}. balance=${balance}, price=${price}, trial=${trialDuration}s, total=${duration}s`,
                  );
                  activePrice = price;
                  sessionTrialDuration = trialDuration;
                  sessionPayerId = payer._id;
                  sessionPayerBalance = balance;
                }
              }
            } else if (payer.role === ROLES.GUEST) {
              // Guest user trial logic: cumulative TRIAL_CHAT_DURATION per guest / IP origin
              const clientIp = payer.ipAddress;
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
          trialDuration: typeof sessionTrialDuration !== "undefined" ? sessionTrialDuration : (parseInt(process.env.TRIAL_CHAT_DURATION) || 600),
          payerId: sessionPayerId || null,
          initialBalance: typeof sessionPayerBalance !== "undefined" ? sessionPayerBalance : 0,
        };
        activeSessions.set(conversationId, session);

        // Notify the first joiner that we're waiting
        socket.emit("timer_sync", {
          timeLeft: duration,
          waiting: true,
          isTrial: session.trialDuration > 0,
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
            const billableSeconds = Math.max(0, elapsedSeconds - (session.trialDuration || 0));
            const billableMinutes = Math.ceil(billableSeconds / 60);
            const currentBalance = session.initialBalance - (billableMinutes * session.pricePerMin);

            io.to(conversationId).emit("timer_sync", {
              timeLeft: session.timeLeft,
              started: true,
              isTrial: session.trialDuration > 0,
              elapsedSeconds,
              balance: currentBalance,
            });

            if (session.timeLeft <= 0) {
              clearInterval(session.timer);

              // Billing Logic
              processChatBilling(session, conversationId).catch((err) =>
                console.error("Error billing session on timer expiry:", err),
              );

              activeSessions.delete(conversationId);
              const endedMessage =
                session.pricePerMin === 0 && session.trialDuration > 0
                  ? "Your free 10-minute signup chat period has ended. Please recharge to continue chatting."
                  : "Session ended. Please check your balance.";
              io.to(conversationId).emit("session_ended", {
                message: endedMessage,
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
          const billableSeconds = Math.max(0, elapsedSeconds - (session.trialDuration || 0));
          const billableMinutes = Math.ceil(billableSeconds / 60);
          const currentBalance = session.initialBalance - (billableMinutes * session.pricePerMin);

          socket.emit("timer_sync", {
            timeLeft: session.timeLeft,
            started: session.started,
            isTrial: session.trialDuration > 0,
            elapsedSeconds,
            balance: currentBalance,
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
            const price = session.pricePerMin || parseInt(process.env.CHAT_PRICE_PER_MIN) || 8;

            const elapsedSeconds = session.actualStartTime
              ? Math.floor((new Date() - session.actualStartTime) / 1000)
              : 0;

            const billableSeconds = Math.max(0, elapsedSeconds - (session.trialDuration || 0));
            const billableMinutes = Math.ceil(billableSeconds / 60);

            const remainingSecondsInCurrentPeriod = Math.max(
              0,
              (session.trialDuration || 0) + (billableMinutes * 60) - elapsedSeconds
            );

            const availableBalance = Math.max(0, newBalance - (billableMinutes * price));
            const additionalMinutes = Math.floor(availableBalance / price);

            session.initialBalance = newBalance;
            session.timeLeft = remainingSecondsInCurrentPeriod + (additionalMinutes * 60);

            console.log(`♻️ Sync recharge for payer ${session.payerId} in ${conversationId}: new balance=${newBalance}, new timeLeft=${session.timeLeft}`);

            io.to(conversationId).emit("timer_sync", {
              timeLeft: session.timeLeft,
              started: true,
              isTrial: session.trialDuration > 0,
              elapsedSeconds,
              balance: newBalance - (billableMinutes * price),
            });

            io.to(conversationId).emit("recharge_applied", {
              balance: newBalance - (billableMinutes * price),
              timeLeft: session.timeLeft,
              message: `Recharge of ₹${newBalance} applied successfully! Chat time extended.`
            });
          }
        } catch (err) {
          console.error("Error syncing recharge inside chat:", err);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
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
app.post(
  "/mateandmentors/bookings/zoom/webhook",
  express.raw({ type: "application/json" }),
  zoomWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
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
app.use("/mateandmentors", allRoutes);

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});
app.use((req, res, next) => {
  throwError(404, "Invalid API");
});

// The Sentry error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

// MongoDb
mongoDb();

// mongoose.connection.once("open", () => {
//   console.log("✅ Mejoric MongoDb connection established");
//   backfillChatSessions(); // Run backfill for old messages
// });

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
