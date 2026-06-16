const { asyncWrapper, sendSuccess } = require("../../utils");

exports.logout = asyncWrapper(async (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true,
  });
  return sendSuccess(res, 200, "Logged out successfully", {});
});
