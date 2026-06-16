const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const { getAllUsers } = require("../../services/users");
const { validateGetAllUsersQuery } = require("../../validator/users");

exports.getAllUsers = asyncWrapper(async (req, res) => {
  const { error } = validateGetAllUsersQuery(req.query);
  if (error) {
    throwError(422, error.details.map((d) => d.message).join(", "));
  }
  const result = await getAllUsers(req.query);
  return sendSuccess(res, 200, "Users fetched successfully", result);
});
