const {
  processBookingReminders,
} = require("../services/bookings/emailNotifications");

const INTERVAL_MS = 60 * 1000;
let reminderTimer = null;

function startBookingReminderJob() {
  if (reminderTimer) return;

  const run = () => {
    processBookingReminders().catch((error) => {
      console.error("❌ Booking reminder job failed:", error);
    });
  };

  run();
  reminderTimer = setInterval(run, INTERVAL_MS);
  if (typeof reminderTimer.unref === "function") {
    reminderTimer.unref();
  }

  console.log("✅ Booking reminder job started (checks every 60s)");
}

function stopBookingReminderJob() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

module.exports = {
  startBookingReminderJob,
  stopBookingReminderJob,
};
