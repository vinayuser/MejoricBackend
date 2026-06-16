const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
} = require("../../utils");
const { getAllContacts } = require("../../services/contacts");
const { validateGetAllContactsQuery } = require("../../validator/contacts");

exports.getAll = asyncWrapper(async (req, res) => {
  const { error, value } = validateGetAllContactsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));
  const result = await getAllContacts(value);
  return sendSuccess(res, 200, "Contacts fetched successfully", result);
});
