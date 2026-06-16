const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { updateContact } = require("../../services/contacts");
const { validateUpdateContact } = require("../../validator/contacts");

exports.update = asyncWrapper(async (req, res) => {
  const { error, value } = validateUpdateContact(req.body);
  if (error) throwError(422, cleanJoiError(error));
  const result = await updateContact(req.params.id, value);
  return sendSuccess(res, 200, "Contact updated successfully", result);
});
