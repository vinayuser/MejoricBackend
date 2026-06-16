const Contact = require("../../models/Contact");
const { throwError, validateObjectId } = require("../../utils");

exports.deleteContact = async (id) => {
  validateObjectId(id, "Invalid contactId");
  const contact = await Contact.findById(id);
  if (!contact || contact.isDeleted) throwError(404, "Contact not found");
  contact.isDeleted = true;
  await contact.save();
};
