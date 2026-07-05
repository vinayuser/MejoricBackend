const { ROLES } = require("../constants");
const User = require("../models/User");
const Mate = require("../models/Mate");
const { updateUserById } = require("../services/users");

const mateSockets = new Map();
const offlineTimeouts = new Map();

const GRACE_MS = 5 * 60 * 1000;

function registerMateSocket(userId, socketId) {
  const key = String(userId);
  if (!mateSockets.has(key)) {
    mateSockets.set(key, new Set());
  }
  mateSockets.get(key).add(socketId);

  if (offlineTimeouts.has(key)) {
    clearTimeout(offlineTimeouts.get(key));
    offlineTimeouts.delete(key);
  }
}

function unregisterMateSocket(userId, socketId) {
  const key = String(userId);
  const sockets = mateSockets.get(key);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size > 0) return;

  mateSockets.delete(key);

  if (offlineTimeouts.has(key)) {
    clearTimeout(offlineTimeouts.get(key));
  }

  const timeout = setTimeout(() => {
    offlineTimeouts.delete(key);
    if (mateSockets.has(key) && mateSockets.get(key).size > 0) return;
    markMateOfflineIfNeeded(key).catch((err) => {
      console.error(`Mate auto-offline failed for ${key}:`, err.message);
    });
  }, GRACE_MS);

  offlineTimeouts.set(key, timeout);
}

async function markMateOfflineIfNeeded(userId) {
  const user = await User.findById(userId).select("role name").lean();
  if (!user || user.role !== ROLES.MATE) return;

  const mate = await Mate.findOne({ userId, isDeleted: false })
    .select("isAvailable")
    .lean();
  if (!mate?.isAvailable) return;

  await updateUserById(
    userId,
    { isAvailable: false },
    null,
    { availabilitySource: "tab_close" },
  );
  console.log(
    `📴 Mate ${user.name || userId} marked offline after 5 min disconnect grace`,
  );
}

module.exports = {
  registerMateSocket,
  unregisterMateSocket,
};
