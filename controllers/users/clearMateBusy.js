const {
  asyncWrapper,
  sendSuccess,
  throwError,
  validateObjectId,
} = require("../../utils");
const { clearMateBusy } = require("../../services/users");

exports.clearMateBusy = asyncWrapper(async (req, res) => {
  const userId = req.body?.userId || req.query?.userId || req.params?.userId;
  if (!userId) throwError(422, "userId is required");

  validateObjectId(userId, "User ID");

  const mate = await clearMateBusy(userId);

  return sendSuccess(res, 200, "Mate busy status cleared", {
    userId,
    isBusy: mate.isBusy,
  });
});
