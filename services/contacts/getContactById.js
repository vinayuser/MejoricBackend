const Contact = require("../../models/Contact");
const { throwError, validateObjectId } = require("../../utils");

exports.getContactById = async (id) => {
  validateObjectId(id, "Invalid contactId");
  const contact = await Contact.findById(id);
  if (!contact || contact.isDeleted) throwError(404, "Contact not found");
  return contact;
};
