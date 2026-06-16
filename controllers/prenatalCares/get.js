const { asyncWrapper, sendSuccess } = require("../../utils");
const { getPrenatalCare } = require("../../services/prenatalCares");

exports.get = asyncWrapper(async (req, res) => {
  const result = await getPrenatalCare(req.params?.id);
  return sendSuccess(res, 200, "Prenatal care fetched", result);
});
