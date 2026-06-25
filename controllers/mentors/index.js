const { ROLES } = require("../../constants");
const { getAllUsers, getUserById } = require("../../services/users");
const { adminResetPassword } = require("../../services/users/adminResetPassword");
const { asyncWrapper, sendSuccess, throwError } = require("../../utils");

exports.getAllMentors = asyncWrapper(async (req, res) => {
  const result = await getAllUsers({
    ...req.query,
    role: ROLES.MENTOR,
  });
  return sendSuccess(res, 200, "Mentors fetched successfully", result);
});

exports.getMentorById = asyncWrapper(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (user?.role !== ROLES.MENTOR || !user?.mentor) {
    throwError(404, "Mentor not found");
  }
  return sendSuccess(res, 200, "Mentor fetched successfully", user);
});

exports.resetMentorPassword = asyncWrapper(async (req, res) => {
  const result = await adminResetPassword(req.params.id, "00000000");
  return sendSuccess(res, 200, result.message, result);
});
