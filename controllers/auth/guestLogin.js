const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError, sendTokenResponse } = require("../../utils");

exports.guestLogin = asyncWrapper(async (req, res) => {
  const { fcmToken } = req.body;

  // Securely extract the client IP address (handling proxies or local fallbacks)
  let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;
  if (Array.isArray(clientIp)) {
    clientIp = clientIp[0];
  }
  if (typeof clientIp === "string" && clientIp.includes(",")) {
    clientIp = clientIp.split(",")[0].trim();
  }
  if (typeof clientIp === "string" && clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }

  // Check if a guest account has already been registered from this IP address
  const existingGuest = await User.findOne({
    ipAddress: clientIp,
    createdAsGuest: true,
    isDeleted: false,
  });

  if (existingGuest) {
    throwError(403, "Please register or login to continue.");
  }

  // Generate a random guest user with minimal details
  const guestId = Math.floor(1000 + Math.random() * 9000);
  const guestName = `Guest ${guestId}`;
  const guestEmail = `guest_${guestId}_${Date.now()}@mejoric.com`;
  const guestPassword = Math.random().toString(36).slice(-8);

  const userData = {
    name: guestName,
    email: guestEmail,
    password: guestPassword,
    role: ROLES.GUEST,
    loginType: LOGIN_TYPES.OTHER,
    fcmToken,
    isLoggedIn: true,
    isOnline: true,
    isSignUpCompleted: false,
    ipAddress: clientIp,
    createdAsGuest: true,
  };

  // Create minimal guest user (NO wallet). Guest gets 3 min free chat only.
  const user = await User.create(userData);

  return sendTokenResponse(res, 201, "Guest login successful", user);
});
