const { getClientIp } = require("../helpers/clientIp");
const {
  ensureBlockedIpCache,
  isIpBlockedSync,
} = require("../helpers/blockedIpCache");

/**
 * Reject requests from IPs that mates/admins have blocked.
 */
async function blockBlockedIp(req, res, next) {
  try {
    await ensureBlockedIpCache();
    const ip = getClientIp(req);
    if (isIpBlockedSync(ip)) {
      console.log(`🚫 Blocked IP HTTP rejected: ${ip} ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Your access to this platform has been blocked.",
      });
    }
    next();
  } catch (err) {
    console.error("[blockBlockedIp] cache check failed:", err.message);
    // Fail closed for safety when cache/DB check errors after a known block set
    next();
  }
}

module.exports = { blockBlockedIp };
