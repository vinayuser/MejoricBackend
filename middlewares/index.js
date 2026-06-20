const { errorHandler } = require("./errorHandler");
const { generateJwtToken } = require("./generateJwtToken");
const { verifyJwtToken } = require("./verifyJwtToken");
const { optionalVerifyJwtToken } = require("./optionalVerifyJwtToken");
const { validateRoles, isAdmin, isUser, isStaff } = require("./validateRoles");

module.exports = {
  errorHandler,
  generateJwtToken,
  verifyJwtToken,
  optionalVerifyJwtToken,
  validateRoles,
  isAdmin,
  isUser,
  isStaff,
};
