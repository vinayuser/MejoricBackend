const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { getUserById } = require("../../services/users");
const { ROLES } = require("../../constants");

exports.getPublicMateProfile = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, "Mate ID");
  
  const user = await getUserById(id);
  
  if (![ROLES.MATE, ROLES.MENTOR].includes(user.role)) {
    throwError(404, "Profile not found");
  }

  return sendSuccess(res, 200, "Profile fetched successfully", user);
});
