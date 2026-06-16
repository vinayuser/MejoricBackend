const { create } = require("./create");
const { getAll } = require("./getAll");
const { getById } = require("./getById");
const { update } = require("./update");
const { deleteContact } = require("./delete");

module.exports = {
  create,
  getAll,
  getById,
  update,
  deleteContact,
};
