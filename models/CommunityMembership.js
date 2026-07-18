const mongoose = require("mongoose");

const communityMembershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

communityMembershipSchema.index(
  { userId: 1, communityId: 1 },
  { unique: true },
);

module.exports = mongoose.model("CommunityMembership", communityMembershipSchema);
