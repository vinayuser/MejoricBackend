const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getAllPrenatalCares } = require("../../services/prenatalCares");
const {
  validateGetAllPrenatalCaresQuery,
} = require("../../validator/prenatalCares");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error } = validateGetAllPrenatalCaresQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllPrenatalCares(req.query);
  return sendSuccess(res, 200, "All prenatal Cares fetched", result);
});
