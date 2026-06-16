const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { verifyWalletTopup } = require("../../services/wallet");
const { validateVerifyWalletTopup } = require("../../validator/wallet");

exports.verifyWalletTopup = asyncWrapper(async (req, res) => {
  const { error, value } = validateVerifyWalletTopup(req.body);
  if (error) throwError(422, cleanJoiError(error));

  const result = await verifyWalletTopup(req.userId, value);
  return sendSuccess(res, 200, "Payment verified and wallet credited", result);
});
