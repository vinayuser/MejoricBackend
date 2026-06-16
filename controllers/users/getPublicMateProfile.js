const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { getUserById } = require("../../services/users");
const { ROLES } = require("../../constants");

exports.getPublicMateProfile = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, "Mate ID");
  
  const user = await getUserById(id);
  
  if (user.role !== ROLES.MATE) {
    throwError(404, "Mate profile not found or user is not a mate");
  }
  
  // Return only necessary public info
  return sendSuccess(res, 200, "Mate profile fetched successfully", user);
});
