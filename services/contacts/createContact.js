const Contact = require("../../models/Contact");

exports.createContact = async (data) => {
  let { name, email, mobile, subject, message } = data;
  name = name?.trim()?.toLowerCase();
  email = email?.trim()?.toLowerCase();
  if (mobile) mobile = mobile?.toString();
  subject = subject?.trim()?.toLowerCase();
  message = message?.trim()?.toLowerCase();
  return await Contact.create({ name, email, mobile, subject, message });
};
