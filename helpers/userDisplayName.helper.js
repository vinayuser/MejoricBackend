function isInternalGuestEmail(email) {
  return /^guest_\d+_\d+@mejoric\.com$/i.test(String(email || "").trim());
}

function getUserDisplayName(user, fallback = "User") {
  if (!user) return fallback;
  if (typeof user === "string") {
    const trimmed = user.trim();
    return trimmed || fallback;
  }

  const name = user.name?.trim();
  if (name) return name;

  const email = user.email?.trim();
  if (email && !isInternalGuestEmail(email)) return email;

  return fallback;
}

function resolveCallOtherPartyName(call, viewerUserIdStr) {
  const callerIdStr = String(call.callerId?._id || call.callerId || "");
  const receiverIdStr = String(call.receiverId?._id || call.receiverId || "");
  const isViewerReceiver = receiverIdStr === viewerUserIdStr;

  const snapshotName = isViewerReceiver ? call.callerName : call.receiverName;
  const snapshotEmail = isViewerReceiver ? call.callerEmail : call.receiverEmail;
  const populated = isViewerReceiver ? call.callerId : call.receiverId;

  if (snapshotName?.trim()) return snapshotName.trim();

  const fromUser = getUserDisplayName(populated, "");
  if (fromUser) return fromUser;

  if (snapshotEmail?.trim() && !isInternalGuestEmail(snapshotEmail)) {
    return snapshotEmail.trim();
  }

  return "User";
}

function resolveChatOtherPartyName(session, isMeSender, populatedOtherUser) {
  const snapshotName = isMeSender ? session.recipientName : session.senderName;
  const snapshotEmail = isMeSender ? session.recipientEmail : session.senderEmail;

  if (snapshotName?.trim()) return snapshotName.trim();

  const fromUser = getUserDisplayName(populatedOtherUser, "");
  if (fromUser) return fromUser;

  if (snapshotEmail?.trim() && !isInternalGuestEmail(snapshotEmail)) {
    return snapshotEmail.trim();
  }

  return "User";
}

module.exports = {
  isInternalGuestEmail,
  getUserDisplayName,
  resolveCallOtherPartyName,
  resolveChatOtherPartyName,
};
