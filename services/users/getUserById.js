const mongoose = require("mongoose");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

function buildProfilePipeline(userId, collection, asKey) {
  return [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: collection,
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$userId", "$$userId"] },
              isDeleted: false,
            },
          },
        ],
        as: asKey,
      },
    },
    {
      $unwind: {
        path: `$${asKey}`,
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        password: 0,
        otp: 0,
        isDeleted: 0,
        __v: 0,
        [`${asKey}.isDeleted`]: 0,
      },
    },
  ];
}

exports.getUserById = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false }).select(
    "-password -otp -isDeleted",
  );
  if (!user) throwError(404, "User not found");

  if (user.role === ROLES.MATE) {
    const data = await User.aggregate(buildProfilePipeline(userId, "mates", "mate"));
    return data?.[0] || user;
  }

  if (user.role === ROLES.MENTOR) {
    const data = await User.aggregate(
      buildProfilePipeline(userId, "mentors", "mentor"),
    );
    return data?.[0] || user;
  }

  return user;
};
