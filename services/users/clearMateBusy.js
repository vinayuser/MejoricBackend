const Mate = require("../../models/Mate");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.clearMateBusy = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throwError(404, "User not found");
  if (user.role !== ROLES.MATE) throwError(400, "User is not a mate");

  const mate = await Mate.findOne({ userId });
  if (!mate) throwError(404, "Mate profile not found");

  mate.isBusy = false;
  await mate.save();

  return mate;
};
