const { sendTransactionalSms } = require("./sendTransactionalSms");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send the same message to multiple mobiles via 2factor (sequential, rate-limited).
 */
exports.sendBulkSms = async (mobiles, message) => {
  const uniqueMobiles = [...new Set(mobiles.filter(Boolean))];
  if (uniqueMobiles.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  const results = [];
  const gapMs = Number(process.env.TWO_FACTOR_BULK_SMS_DELAY_MS) || 200;

  for (const mobile of uniqueMobiles) {
    try {
      const result = await sendTransactionalSms(mobile, message);
      results.push({ mobile, success: true, ...result });
    } catch (error) {
      results.push({
        mobile,
        success: false,
        error: error.message || "Failed to send SMS",
      });
    }
    if (gapMs > 0) await delay(gapMs);
  }

  return {
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    total: uniqueMobiles.length,
    results,
  };
};
