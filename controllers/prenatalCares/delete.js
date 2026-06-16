const { asyncWrapper, sendSuccess } = require("../../utils");
const { deletePrenatalCare } = require("../../services/prenatalCares");

exports.deletePrenatalCare = asyncWrapper(async (req, res) => {
  await deletePrenatalCare(req.params?.id);
  return sendSuccess(res, 200, "Prenatal care deleted successfully");
});
