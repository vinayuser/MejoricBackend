const User = require("../../models/User");
const { ROLES, LOGIN_TYPES } = require("../../constants");
const {
  asyncWrapper,
  sendSuccess,
  throwError,
  sendTokenResponse,
} = require("../../utils");
const {
  getClientIp,
  guestDisplayName,
  looksLikeIpAddress,
} = require("../../helpers/clientIp");

/**
 * Find-or-create a guest for this IP.
 * Display name is "Guest ####" for mates; IP is stored only on ipAddress for tracking.
 */
exports.guestLogin = asyncWrapper(async (req, res) => {
  const { fcmToken } = req.body;
  const clientIp = getClientIp(req);

  // Prefer an active guest account for this IP (resume chat identity)
  let guest = await User.findOne({
    ipAddress: clientIp,
    role: ROLES.GUEST,
    isDeleted: false,
  });

  if (guest) {
    // Replace legacy IP-as-name so mates never see the IP
    if (looksLikeIpAddress(guest.name) || !guest.name) {
      guest.name = guestDisplayName();
    }
    guest.isLoggedIn = true;
    guest.isOnline = true;
    if (fcmToken) guest.fcmToken = fcmToken;
    await guest.save();
    return sendTokenResponse(res, 200, "Guest session resumed", guest);
  }

  // Former guest from this IP already registered — do not create another guest
  const converted = await User.findOne({
    ipAddress: clientIp,
    createdAsGuest: true,
    role: { $ne: ROLES.GUEST },
    isDeleted: false,
  });
  if (converted) {
    throwError(403, "Please register or login to continue.");
  }

  const displayName = guestDisplayName();
  const guestEmail = `guest_${Buffer.from(clientIp)
    .toString("hex")
    .slice(0, 24)}_${Date.now()}@mejoric.com`;
  const guestPassword = Math.random().toString(36).slice(-10);

  guest = await User.create({
    name: displayName,
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
  });

  return sendTokenResponse(res, 201, "Guest login successful", guest);
});
