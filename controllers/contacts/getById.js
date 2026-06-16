const { asyncWrapper, sendSuccess } = require("../../utils");
const { getContactById } = require("../../services/contacts");

exports.getById = asyncWrapper(async (req, res) => {
  const result = await getContactById(req.params.id);
  return sendSuccess(res, 200, "Contact fetched successfully", result);
});
