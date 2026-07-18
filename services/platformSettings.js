const PlatformSetting = require("../models/PlatformSetting");

const KEYS = {
  COMMUNITY_UNLOCK_AMOUNT: "COMMUNITY_UNLOCK_AMOUNT",
};

const cache = new Map();
const CACHE_TTL_MS = 30_000;

function envUnlockFallback() {
  const n = parseInt(process.env.COMMUNITY_UNLOCK_AMOUNT, 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

exports.KEYS = KEYS;

exports.getSetting = async (key, fallback = null) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  const row = await PlatformSetting.findOne({ key }).lean();
  const value = row ? row.value : fallback;
  cache.set(key, { value, at: Date.now() });
  return value;
};

exports.setSetting = async (key, value, updatedBy) => {
  const row = await PlatformSetting.findOneAndUpdate(
    { key },
    { value, updatedBy },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  cache.set(key, { value: row.value, at: Date.now() });
  return row;
};

exports.clearSettingCache = (key) => {
  if (key) cache.delete(key);
  else cache.clear();
};

exports.getCommunityUnlockAmount = async () => {
  const raw = await exports.getSetting(
    KEYS.COMMUNITY_UNLOCK_AMOUNT,
    envUnlockFallback(),
  );
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : envUnlockFallback();
};

exports.setCommunityUnlockAmount = async (amount, updatedBy) => {
  const n = Math.round(Number(amount));
  if (!Number.isFinite(n) || n < 1) {
    const { throwError } = require("../../utils");
    throwError(422, "Unlock amount must be a positive number");
  }
  if (n > 100000) {
    const { throwError } = require("../../utils");
    throwError(422, "Unlock amount is too large");
  }
  return exports.setSetting(KEYS.COMMUNITY_UNLOCK_AMOUNT, n, updatedBy);
};
