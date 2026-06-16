const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getWallet } = require("../../services/wallet");

exports.getWallet = asyncWrapper(async (req, res) => {
  const result = await getWallet(req.userId);
  return sendSuccess(res, 200, "Wallet fetched successfully", result);
});
