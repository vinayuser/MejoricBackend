const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { updatePrenatalCare } = require("../../services/prenatalCares");
const { validateUpdatePrenatalCare } = require("../../validator/prenatalCares");

exports.update = asyncWrapper(async (req, res) => {
  const { error, value } = validateUpdatePrenatalCare(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const image = req.files?.image;
  const updated = await updatePrenatalCare(req.params?.id, value, image);
  return sendSuccess(res, 200, "Prenatal care updated", updated);
});
