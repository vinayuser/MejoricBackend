const User = require("../../models/User");
const { ROLES } = require("../../constants");
const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const { sendBulkSms } = require("../../services/otp/sendBulkSms");

const ALLOWED_ROLES = [
  ROLES.USER,
  ROLES.MATE,
  ROLES.MENTOR,
  ROLES.ADMIN,
  ROLES.STAFF,
];

exports.sendBulkSms = asyncWrapper(async (req, res) => {
  const { message, role, userIds, mobiles } = req.body;

  if (!message || !String(message).trim()) {
    throwError(422, "Message is required");
  }

  let targetMobiles = [];

  if (Array.isArray(mobiles) && mobiles.length > 0) {
    targetMobiles = mobiles;
  } else {
    const query = { isDeleted: false, mobile: { $exists: true, $ne: "" } };

    if (Array.isArray(userIds) && userIds.length > 0) {
      query._id = { $in: userIds };
    } else if (role) {
      const normalizedRole = String(role).toLowerCase();
      if (!ALLOWED_ROLES.includes(normalizedRole)) {
        throwError(422, "Invalid role filter");
      }
      query.role = normalizedRole;
    } else {
      throwError(
        422,
        "Provide mobiles[], userIds[], or a role to select recipients",
      );
    }

    const users = await User.find(query).select("mobile").lean();
    targetMobiles = users.map((u) => u.mobile).filter(Boolean);
  }

  const uniqueMobiles = [...new Set(targetMobiles.map((m) => String(m).trim()))];
  if (uniqueMobiles.length === 0) {
    throwError(422, "No valid mobile numbers found for the selected recipients");
  }

  const maxRecipients = Number(process.env.TWO_FACTOR_BULK_SMS_MAX) || 500;
  if (uniqueMobiles.length > maxRecipients) {
    throwError(
      422,
      `Too many recipients (${uniqueMobiles.length}). Max allowed: ${maxRecipients}`,
    );
  }

  const result = await sendBulkSms(uniqueMobiles, String(message).trim());

  return sendSuccess(res, 200, "Bulk SMS processed", result);
});
