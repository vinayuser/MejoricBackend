const User = require("../../models/User");
const Mate = require("../../models/Mate");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.deleteUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user || user?.isDeleted) throwError(404, "User not found");

  user.isDeleted = true;
  await user.save();

  if (user.role === ROLES.MATE) {
    await Mate.updateOne(
      { userId: user._id, isDeleted: false },
      { $set: { isDeleted: true } },
    );
  }

  return true;
};
