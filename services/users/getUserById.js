const mongoose = require("mongoose");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.getUserById = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false }).select(
    "-password -otp -isDeleted",
  );
  if (!user) throwError(404, "User not found");

  if (user.role !== ROLES.MATE) return user;

  const pipeline = [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: "mates",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$userId", "$$userId"] },
              isDeleted: false,
            },
          },
        ],
        as: "mate",
      },
    },
    {
      $unwind: {
        path: "$mate",
        preserveNullAndEmptyArrays: true,
      },
    },
    // {
    //   $lookup: {
    //     from: "categories",
    //     localField: "mate.categoryId",
    //     foreignField: "_id",
    //     as: "category",
    //   },
    // },
    // {
    //   $unwind: {
    //     path: "$category",
    //     preserveNullAndEmptyArrays: true,
    //   },
    // },
    {
      $project: {
        password: 0,
        otp: 0,
        isDeleted: 0,
        __v: 0,
        "mate.isDeleted": 0,
      },
    },
  ];
  const data = await User.aggregate(pipeline);
  const enriched = data?.[0];
  return enriched || user;
};
