const { admin, isFirebaseInitialized } = require("../configs/firebase");
const Notification = require("../models/Notifications");
const User = require("../models/User");

/**
 * FCM requires every value in `data` to be a string (Web + native).
 * Non-string values (e.g. numeric EnableX room_id) cause send() to fail and
 * the receiver gets no push — common on mobile Chrome.
 */
function toFcmDataStrings(obj = {}) {
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "object" && !(val instanceof Date)) {
      try {
        out[key] = JSON.stringify(val);
      } catch {
        out[key] = String(val);
      }
    } else {
      out[key] = String(val);
    }
  }
  return out;
}

const sendPushNotification = async ({
  userId,
  fcmToken,
  title,
  body,
  data = {},
  type = "CALL",
  referenceId,
}) => {
  try {
    // Log notification to DB
    if (userId) {
      await Notification.create({
        userId,
        title,
        message: body,
        type,
        referenceId,
      });
    }

    if (!isFirebaseInitialized || !fcmToken) {
      console.warn(
        "Push notification skipped: Firebase not initialized or FCM token missing",
      );
      return null;
    }

    let message;

    if (
      type === "CALL" ||
      type === "CHAT_INITIATED" ||
      type === "CHAT_ACCEPTED" ||
      type === "CHAT_MESSAGE" ||
      type === "CHAT_ENDED"
    ) {
      const isAlertingType =
        type === "CALL" || type === "CHAT_INITIATED" || type === "CHAT_MESSAGE";
      // Data-only + SW `showNotification` keeps full `data` on the notification for
      // taps (FCM auto-display from a top-level `notification` often drops custom data on web).
      const openLink =
        process.env.FRONTEND_BASE_URL ||
        process.env.WEB_BASE_URL ||
        process.env.APP_BASE_URL ||
        "https://mejoric.com";

      const dataPayload = toFcmDataStrings({
        ...data,
        // Explicit type so web SW + foreground handlers reliably detect calls
        type: type || "incoming_call",
        // Include title/body in data so SW can use them
        title: title || "Incoming Call",
        body: body || "You have an incoming call",
        timestamp: Date.now().toString(),
        senderOrigin: openLink.replace(/\/$/, ""),
      });

      message = {
        token: fcmToken,
        notification: {
          title: title || "New Notification",
          body: body || "You have a new message",
        },
        data: dataPayload,
        // Android-specific: high priority ensures delivery even when dozing
        android: {
          priority: "high",
          collapseKey: "MNM_ALERTS",
        },
        // Web (Chrome mobile/desktop): data-only needs explicit webpush for
        // timely delivery and click-through; android block alone is ignored.
        webpush: {
          headers: {
            Urgency: "high",
            // Drop stale call invites quickly
            TTL: "120",
            Topic: "mnm_alerts",
          },
          notification: {
            title: title || "New Notification",
            body: body || "You have a new message",
            icon: "/logo192.png",
          },
          fcmOptions: {
            link: openLink.replace(/\/$/, "") + "/",
          },
        },
        // APNs (iOS): content-available triggers background processing
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-collapse-id": "MNM_ALERTS",
          },
          payload: {
            aps: {
              // Only include alert and sound for interactive/alerting types
              ...(isAlertingType && {
                alert: {
                  title: title || "New Notification",
                  body: body || "You have a new message",
                },
                sound: "default",
              }),
              "content-available": 1,
            },
          },
        },
      };

      // Suppress top-level notification block for non-alerting types to prevent
      // duplicate sounds/alerts in the foreground on web/mobile.
      if (!isAlertingType) {
        delete message.notification;
        if (message.webpush) delete message.webpush.notification;
      }
    } else {
      // For non-call notifications, use standard notification + data payload
      const openLink =
        process.env.FRONTEND_BASE_URL ||
        process.env.WEB_BASE_URL ||
        process.env.APP_BASE_URL ||
        "https://mejoric.com";

      message = {
        notification: {
          title,
          body,
        },
        data: toFcmDataStrings({
          ...data,
          timestamp: Date.now().toString(),
          senderOrigin: openLink.replace(/\/$/, ""),
        }),
        token: fcmToken,
        android: { collapseKey: "MNM_ALERTS" },
        webpush: { headers: { Topic: "mnm_alerts" } },
        apns: { headers: { "apns-collapse-id": "MNM_ALERTS" } },
      };
    }

    // Dispatch to Firebase
    console.log(
      `[FCM] Dispatching ${type} to user ${userId} (Token: ${fcmToken.substring(0, 10)}...)`,
    );
    const response = await admin.messaging().send(message);
    console.log(
      `[FCM] Successfully sent ${type}. Firebase Response:`,
      response,
    );

    return response;
  } catch (error) {
    console.error(
      `[FCM ERROR] Failed to send ${type} to user ${userId}:`,
      error.message,
    );
    // Special case: if token is invalid, we might want to clear it from the user model
    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(
        `[FCM] Token for user ${userId} is stale/unregistered. Clearing from DB.`,
      );
      await User.findByIdAndUpdate(userId, { fcmToken: null });
    }
    return null;
  }
};

module.exports = {
  sendPushNotification,
};
