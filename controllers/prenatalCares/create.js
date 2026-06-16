const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createPrenatalCare } = require("../../services/prenatalCares");
const { validateCreatePrenatalCare } = require("../../validator/prenatalCares");

exports.create = asyncWrapper(async (req, res) => {
  const { error } = validateCreatePrenatalCare(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const image = req.files?.image;
  const result = await createPrenatalCare(req.body, image);
  return sendSuccess(res, 201, "Prenatal care created", result);
});
