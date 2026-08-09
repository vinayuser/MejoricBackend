const mongoose = require("mongoose");
const User = require("../../models/User");
const BlockedIp = require("../../models/BlockedIp");
const { ROLES } = require("../../constants");
const {
  asyncWrapper,
  sendSuccess,
  throwError,
  pagination,
} = require("../../utils");
const {
  isPrivateOrLocalIp,
  normalizeIp,
} = require("../../helpers/clientIp");
const cloudflareIpBlock = require("../../helpers/cloudflareIpBlock");
const {
  addBlockedIpToCache,
  removeBlockedIpFromCache,
} = require("../../helpers/blockedIpCache");

const PROTECTED_ROLES = new Set([ROLES.ADMIN, ROLES.STAFF, ROLES.MATE, ROLES.MENTOR]);

/**
 * Mate/mentor blocks a peer by stored User.ipAddress → Cloudflare + DB.
 */
exports.blockIp = asyncWrapper(async (req, res) => {
  const actor = req.user;
  const { targetUserId, reason = "", source = "mate_chat" } = req.body || {};

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    throwError(400, "Valid targetUserId is required");
  }

  const actorId = String(actor._id);
  if (String(targetUserId) === actorId) {
    throwError(400, "You cannot block yourself");
  }

  const target = await User.findOne({
    _id: targetUserId,
    isDeleted: false,
  });
  if (!target) throwError(404, "User not found");

  if (PROTECTED_ROLES.has(target.role)) {
    throwError(403, "You cannot block mates, mentors, or staff accounts");
  }

  const ip = normalizeIp(target.ipAddress || "");
  if (!ip) {
    throwError(
      400,
      "No IP on file for this user. They must reconnect once so we can capture their IP.",
    );
  }

  const existing = await BlockedIp.findOne({
    isActive: true,
    $or: [{ ip }, { ip: target.ipAddress }],
  });
  if (existing) {
    throwError(400, "This IP is already blocked");
  }

  let cfRuleId = null;
  if (!isPrivateOrLocalIp(ip)) {
    if (!cloudflareIpBlock.isConfigured()) {
      throwError(
        503,
        "Cloudflare is not configured. Cannot create an edge IP block.",
      );
    }
    try {
      const cf = await cloudflareIpBlock.blockIp(
        ip,
        `Blocked by ${actor.name || actor.role} (${source}): ${reason || "abuse"}`.slice(
          0,
          500,
        ),
      );
      cfRuleId = cf.ruleId || null;
    } catch (err) {
      console.error("[moderation/blockIp] Cloudflare error:", err.message);
      throwError(502, err.message || "Failed to block IP on Cloudflare");
    }
  } else {
    console.warn(
      `[moderation/blockIp] Skipping Cloudflare for private/local IP ${ip}`,
    );
  }

  const allowedSources = ["mate_chat", "mate_call", "admin"];
  const resolvedSource = allowedSources.includes(source) ? source : "mate_chat";

  const record = await BlockedIp.create({
    ip,
    targetUserId: target._id,
    targetUserName: target.name || "",
    targetUserRole: target.role,
    blockedBy: actor._id,
    blockedByName: actor.name || actor.role,
    source: resolvedSource,
    reason: String(reason || "").slice(0, 500),
    cfRuleId,
    isActive: true,
  });

  target.isActive = false;
  await target.save();
  // Public IPs → edge + HTTP/socket gate. Private/local → account flag only.
  addBlockedIpToCache(ip);

  // Best-effort: end active chat room if conversationId provided
  const conversationId = req.body?.conversationId;
  const io = req.app.get("io");
  if (io && conversationId) {
    io.to(conversationId).emit("session_ended", {
      endedBy: actor.name || "Mate",
      reason: "user_blocked",
      message: "This session was ended because the user was blocked.",
    });
  }
  if (io && target._id) {
    io.to(`user_${target._id}`).emit("force_logout", {
      reason: "blocked",
      message: "Your access to this platform has been blocked.",
    });
  }

  return sendSuccess(res, 200, "User IP blocked successfully", {
    id: record._id,
    ip: record.ip,
    cfRuleId: record.cfRuleId,
    targetUserId: target._id,
  });
});

/**
 * Admin: paginated list of blocked IPs / users.
 */
exports.listBlockedIps = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, search = "", active } = req.query;
  const match = {};

  if (active === "false") {
    match.isActive = false;
  } else if (active === "all") {
    // no filter
  } else {
    match.isActive = true;
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    match.$or = [
      { ip: { $regex: q, $options: "i" } },
      { targetUserName: { $regex: q, $options: "i" } },
      { blockedByName: { $regex: q, $options: "i" } },
      { reason: { $regex: q, $options: "i" } },
    ];
  }

  const result = await pagination(
    BlockedIp,
    [{ $match: match }, { $sort: { createdAt: -1 } }],
    page,
    limit,
  );

  return sendSuccess(res, 200, "Blocked IPs fetched", result);
});

/**
 * Admin: remove Cloudflare rule + deactivate BlockedIp; re-activate user if safe.
 */
exports.unblockIp = asyncWrapper(async (req, res) => {
  const { id } = req.body || {};
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throwError(400, "Valid blocked record id is required");
  }

  const record = await BlockedIp.findById(id);
  if (!record) throwError(404, "Blocked IP record not found");
  if (!record.isActive) {
    return sendSuccess(res, 200, "IP was already unblocked", { id: record._id });
  }

  if (record.cfRuleId) {
    try {
      await cloudflareIpBlock.unblockIp(record.cfRuleId);
    } catch (err) {
      console.error("[moderation/unblockIp] Cloudflare error:", err.message);
      throwError(502, err.message || "Failed to remove Cloudflare IP rule");
    }
  }

  record.isActive = false;
  await record.save();
  removeBlockedIpFromCache(record.ip);

  if (record.targetUserId) {
    const otherActive = await BlockedIp.exists({
      targetUserId: record.targetUserId,
      isActive: true,
    });
    if (!otherActive) {
      await User.updateOne(
        { _id: record.targetUserId },
        { $set: { isActive: true } },
      );
    }
  }

  return sendSuccess(res, 200, "IP unblocked successfully", {
    id: record._id,
    ip: record.ip,
  });
});
