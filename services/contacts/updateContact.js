const Contact = require("../../models/Contact");
const { throwError, validateObjectId } = require("../../utils");

exports.updateContact = async (id, payload) => {
  validateObjectId(id, "Invalid contactId");
  const contact = await Contact.findById(id);
  if (!contact || contact.isDeleted) throwError(404, "Contact not found");
  let { name, email, mobile, subject, message } = payload;
  if (name) name = name?.trim()?.toLowerCase();
  if (email) email = email?.trim()?.toLowerCase();
  if (mobile) mobile = mobile?.trim()?.toString();
  if (subject) subject = subject?.trim()?.toLowerCase();
  if (message) message = message?.trim()?.toLowerCase();
  return await Contact.findByIdAndUpdate(id, { name, email, mobile, subject, message }, { returnDocument: 'after' });
};
