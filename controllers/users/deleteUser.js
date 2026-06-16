const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { deleteUserById } = require("../../services/users");
const { ROLES } = require("../../constants");

exports.deleteUser = asyncWrapper(async (req, res) => {
  const userId = req.query?.userId || req.userId;
  if (!userId) throwError(422, "User ID is required");
  validateObjectId(userId, "User ID");
  if (String(userId) !== String(req.userId) && req.role !== ROLES.ADMIN) {
    throwError(403, "You can only delete your own account or need admin access");
  }
  await deleteUserById(userId);
  return sendSuccess(res, 200, "User deleted successfully");
});
