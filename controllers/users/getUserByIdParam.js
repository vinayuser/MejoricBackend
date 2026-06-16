const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { getUserById } = require("../../services/users");
const { ROLES } = require("../../constants");

exports.getUserByIdParam = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, "User ID");
  const user = await getUserById(id);

  const isAuthorized =
    String(id) === String(req.userId) ||
    req.role === ROLES.ADMIN ||
    req.role === ROLES.MATE ||
    req.role === ROLES.MENTOR ||
    user.role === ROLES.MATE ||
    user.role === ROLES.MENTOR;

  if (!isAuthorized) {
    throwError(403, "You can only access your own profile or need admin access");
  }

  return sendSuccess(res, 200, "User fetched successfully", user);
});
