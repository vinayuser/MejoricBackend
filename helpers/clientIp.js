/**
 * Resolve client IP behind proxies (x-forwarded-for) and strip IPv6-mapped prefixes.
 */
function getClientIp(req) {
  let clientIp =
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip;
  if (Array.isArray(clientIp)) {
    clientIp = clientIp[0];
  }
  if (typeof clientIp === "string" && clientIp.includes(",")) {
    clientIp = clientIp.split(",")[0].trim();
  }
  if (typeof clientIp === "string" && clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }
  if (!clientIp || clientIp === "::1") {
    clientIp = "127.0.0.1";
  }
  return String(clientIp).trim();
}

/** Friendly guest display name for mates (never show raw IP). */
function guestDisplayName() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Guest ${n}`;
}

/** True if stored name looks like an IP (legacy guest naming). */
function looksLikeIpAddress(name) {
  const s = String(name || "").trim();
  if (!s) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return true;
  if (s.includes(":") && /^[0-9a-fA-F:.]+$/.test(s)) return true;
  return false;
}

module.exports = {
  getClientIp,
  guestDisplayName,
  guestDisplayNameFromIp: guestDisplayName,
  looksLikeIpAddress,
};
