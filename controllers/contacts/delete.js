const { asyncWrapper, sendSuccess } = require("../../utils");
const { deleteContact } = require("../../services/contacts");

exports.deleteContact = asyncWrapper(async (req, res) => {
  await deleteContact(req.params.id);
  return sendSuccess(res, 200, "Contact deleted successfully");
});
