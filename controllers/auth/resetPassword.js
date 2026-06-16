const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { resetPassword } = require("../../services/auth");
const { validateResetPassword } = require("../../validator/auth");

exports.resetPassword = asyncWrapper(async (req, res) => {
  const { error, value } = validateResetPassword(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await resetPassword(value);
  return sendSuccess(res, 200, "Password reset successfully", result);
});
