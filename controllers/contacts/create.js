const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { createContact } = require("../../services/contacts");
const { validateCreateContact } = require("../../validator/contacts");

exports.create = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateContact(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await createContact(value);
  return sendSuccess(res, 201, "Contact created successfully", result);
});
