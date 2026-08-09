/**
 * Resolve client IP behind Cloudflare / proxies.
 * Prefer CF-Connecting-IP, then first X-Forwarded-For hop, then socket IP.
 */
function normalizeIp(raw) {
  let clientIp = raw;
  if (Array.isArray(clientIp)) {
    clientIp = clientIp[0];
  }
  if (typeof clientIp === "string" && clientIp.includes(",")) {
    clientIp = clientIp.split(",")[0].trim();
  }
  if (typeof clientIp !== "string") {
    clientIp = clientIp == null ? "" : String(clientIp);
  }
  clientIp = clientIp.trim();
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }
  // Normalize all loopback forms to 127.0.0.1 so block checks match
  if (
    !clientIp ||
    clientIp === "::1" ||
    clientIp === "0:0:0:0:0:0:0:1" ||
    clientIp === "localhost"
  ) {
    clientIp = "127.0.0.1";
  }
  return clientIp;
}

function getClientIp(req) {
  const headers = req?.headers || {};
  const raw =
    headers["cf-connecting-ip"] ||
    headers["CF-Connecting-IP"] ||
    headers["x-real-ip"] ||
    headers["x-forwarded-for"] ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    req?.ip;
  return normalizeIp(raw);
}

function getIpFromSocket(socket) {
  return getClientIp({
    headers: socket?.handshake?.headers || {},
    socket: socket?.conn,
    connection: socket?.conn,
    ip: socket?.handshake?.address,
  });
}

/** Loopback / RFC1918 — skip Cloudflare edge rules (still enforce in-app). */
function isPrivateOrLocalIp(ip) {
  const s = normalizeIp(ip);
  if (!s) return true;
  if (s === "127.0.0.1" || s === "0.0.0.0") return true;
  if (s.startsWith("10.")) return true;
  if (s.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(s)) return true;
  return false;
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
  getIpFromSocket,
  normalizeIp,
  isPrivateOrLocalIp,
  guestDisplayName,
  guestDisplayNameFromIp: guestDisplayName,
  looksLikeIpAddress,
};
