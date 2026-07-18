const Community = require("../../models/Community");
const CommunityMembership = require("../../models/CommunityMembership");
const { throwError } = require("../../utils");
const { hasCommunityAccess } = require("./accessHelpers");
const { formatCommunity } = require("./listCommunities");

exports.joinCommunity = async (userId, communityId) => {
  const unlocked = await hasCommunityAccess(userId);
  if (!unlocked) {
    throwError(402, "Community unlock required. Pay ₹100 once to join communities.");
  }

  const community = await Community.findOne({
    _id: communityId,
    isDeleted: false,
    isActive: true,
  });
  if (!community) throwError(404, "Community not found");

  const existing = await CommunityMembership.findOne({
    userId,
    communityId,
  });

  if (existing && !existing.isDeleted) {
    return formatCommunity(community.toObject(), { joined: true, unlocked: true });
  }

  if (existing && existing.isDeleted) {
    existing.isDeleted = false;
    existing.joinedAt = new Date();
    await existing.save();
  } else {
    await CommunityMembership.create({ userId, communityId });
  }

  await Community.updateOne(
    { _id: communityId },
    { $inc: { memberCount: 1 } },
  );
  community.memberCount = (community.memberCount || 0) + 1;

  return formatCommunity(community.toObject(), { joined: true, unlocked: true });
};

exports.leaveCommunity = async (userId, communityId) => {
  const membership = await CommunityMembership.findOne({
    userId,
    communityId,
    isDeleted: false,
  });
  if (!membership) throwError(404, "You are not a member of this community");

  membership.isDeleted = true;
  await membership.save();

  await Community.updateOne(
    { _id: communityId, memberCount: { $gt: 0 } },
    { $inc: { memberCount: -1 } },
  );

  const community = await Community.findById(communityId).lean();
  const unlocked = await hasCommunityAccess(userId);
  return formatCommunity(community, { joined: false, unlocked });
};
