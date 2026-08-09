const BlockedIp = require("../models/BlockedIp");
const { normalizeIp, isPrivateOrLocalIp } = require("./clientIp");

/** In-memory set of actively blocked IPs for fast request checks. */
let blockedSet = new Set();
let loaded = false;
let loadingPromise = null;

async function refreshBlockedIpCache() {
  const rows = await BlockedIp.find({ isActive: true }).select("ip").lean();
  // Private/loopback IPs are enforced via User.isActive only — blocking
  // 127.0.0.1 would lock every local browser (mate + guest share it).
  blockedSet = new Set(
    rows
      .map((r) => normalizeIp(r.ip))
      .filter((ip) => ip && !isPrivateOrLocalIp(ip)),
  );
  loaded = true;
  return blockedSet.size;
}

async function ensureBlockedIpCache() {
  if (loaded) return;
  if (!loadingPromise) {
    loadingPromise = refreshBlockedIpCache().finally(() => {
      loadingPromise = null;
    });
  }
  await loadingPromise;
}

function isIpBlockedSync(ip) {
  if (!ip) return false;
  return blockedSet.has(normalizeIp(ip));
}

async function isIpBlocked(ip) {
  await ensureBlockedIpCache();
  return isIpBlockedSync(ip);
}

function addBlockedIpToCache(ip) {
  const normalized = normalizeIp(ip);
  if (normalized && !isPrivateOrLocalIp(normalized)) {
    blockedSet.add(normalized);
  }
}

function removeBlockedIpFromCache(ip) {
  if (ip) blockedSet.delete(normalizeIp(ip));
}

module.exports = {
  refreshBlockedIpCache,
  ensureBlockedIpCache,
  isIpBlocked,
  isIpBlockedSync,
  addBlockedIpToCache,
  removeBlockedIpFromCache,
};
