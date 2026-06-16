const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createWalletTopupOrder } = require("../../services/wallet");
const { validateCreateWalletTopupOrder } = require("../../validator/wallet");

exports.createWalletTopupOrder = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateWalletTopupOrder(req.body);
  if (error) throwError(422, cleanJoiError(error));

  const result = await createWalletTopupOrder(req.userId, value);
  return sendSuccess(res, 200, "Order created successfully", result);
});
