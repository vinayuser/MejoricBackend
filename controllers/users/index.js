const { getUser } = require("./getUser");
const { getUserByIdParam } = require("./getUserByIdParam");
const { getPublicMateProfile } = require("./getPublicMateProfile");
const { getAllUsers } = require("./getAllUsers");
const { updateUser } = require("./updateUser");
const { deleteUser } = require("./deleteUser");
const { updateFcmToken } = require("./updateFcmToken");

module.exports = {
  getUser,
  getUserByIdParam,
  getPublicMateProfile,
  getAllUsers,
  updateUser,
  deleteUser,
  updateFcmToken,
};
