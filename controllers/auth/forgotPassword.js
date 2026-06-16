const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { forgotPassword } = require("../../services/auth");
const { validateForgotPassword } = require("../../validator/auth");

exports.forgotPassword = asyncWrapper(async (req, res) => {
  const { error, value } = validateForgotPassword(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await forgotPassword(value);
  return sendSuccess(
    res,
    200,
    "Reset link sent to your email successfully",
    result,
  );
});
