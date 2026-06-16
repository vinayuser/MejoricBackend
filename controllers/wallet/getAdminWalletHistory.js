const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getAdminWalletHistory } = require("../../services/wallet");
const { validateAdminWalletHistoryQuery } = require("../../validator/wallet");

exports.getAdminWalletHistory = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminWalletHistoryQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAdminWalletHistory(value);
  return sendSuccess(
    res,
    200,
    "Admin wallet history fetched successfully",
    result,
  );
});
