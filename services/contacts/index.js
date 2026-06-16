const { createContact } = require("./createContact");
const { getContactById } = require("./getContactById");
const { getAllContacts } = require("./getAllContacts");
const { updateContact } = require("./updateContact");
const { deleteContact } = require("./deleteContact");

module.exports = {
  createContact,
  getContactById,
  getAllContacts,
  updateContact,
  deleteContact,
};
