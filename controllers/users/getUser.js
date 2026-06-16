const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { getUserById } = require("../../services/users");
const { ROLES } = require("../../constants");

exports.getUser = asyncWrapper(async (req, res) => {
  let targetId = req.userId;
  if (req.query?.userId) {
    const q = req.query.userId;
    if (String(q) !== String(req.userId)) {
      if (req.role !== ROLES.ADMIN) {
        throwError(403, "You can only fetch your own profile or need admin access");
      }
      validateObjectId(q, "User ID");
      targetId = q;
    } else {
      targetId = q;
    }
  }
  if (!targetId) throwError(401, "Authentication required");
  const user = await getUserById(targetId);
  return sendSuccess(res, 200, "User fetched successfully", user);
});
