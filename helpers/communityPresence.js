/**
 * In-memory presence for community chat rooms.
 * communityId -> userId -> Set(socketId)
 */
const presence = new Map();

function roomName(communityId) {
  return `community_${String(communityId)}`;
}

function watchRoomName(communityId) {
  return `community_watch_${String(communityId)}`;
}

function addPresence(communityId, userId, socketId) {
  const cid = String(communityId);
  const uid = String(userId);
  if (!presence.has(cid)) presence.set(cid, new Map());
  const users = presence.get(cid);
  if (!users.has(uid)) users.set(uid, new Set());
  users.get(uid).add(String(socketId));
}

function removePresence(communityId, userId, socketId) {
  const cid = String(communityId);
  const uid = String(userId);
  const users = presence.get(cid);
  if (!users) return;
  const sockets = users.get(uid);
  if (!sockets) return;
  sockets.delete(String(socketId));
  if (sockets.size === 0) users.delete(uid);
  if (users.size === 0) presence.delete(cid);
}

function removeSocketFromAll(socketId, communityIds = []) {
  const sid = String(socketId);
  const affected = new Set(communityIds.map(String));
  for (const [cid, users] of presence.entries()) {
    for (const [uid, sockets] of users.entries()) {
      if (sockets.has(sid)) {
        sockets.delete(sid);
        affected.add(cid);
        if (sockets.size === 0) users.delete(uid);
      }
    }
    if (users.size === 0) presence.delete(cid);
  }
  return [...affected];
}

function getOnlineCount(communityId) {
  const users = presence.get(String(communityId));
  return users ? users.size : 0;
}

function getOnlineCounts(communityIds = []) {
  const out = {};
  for (const id of communityIds) {
    out[String(id)] = getOnlineCount(id);
  }
  return out;
}

module.exports = {
  roomName,
  watchRoomName,
  addPresence,
  removePresence,
  removeSocketFromAll,
  getOnlineCount,
  getOnlineCounts,
};
