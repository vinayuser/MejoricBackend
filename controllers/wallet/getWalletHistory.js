const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getWalletHistory } = require("../../services/wallet");
const { validateWalletHistoryQuery } = require("../../validator/wallet");

exports.getWalletHistory = asyncWrapper(async (req, res) => {
  const { error, value } = validateWalletHistoryQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const result = await getWalletHistory(req.userId, value);
  return sendSuccess(res, 200, "Wallet history fetched successfully", result);
});
