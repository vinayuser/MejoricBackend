const Community = require("../../models/Community");
const CommunityMembership = require("../../models/CommunityMembership");
const { throwError } = require("../../utils");
const { hasCommunityAccess, getUnlockAmount } = require("./accessHelpers");

const DEFAULT_AVS = ["#7c6ba8", "#a593cc", "#5f4f86"];

exports.formatCommunity = (doc, { joined = false, unlocked = false } = {}) => {
  const c = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(c._id),
    _id: c._id,
    name: c.name,
    desc: c.description || "",
    description: c.description || "",
    who: c.who || "",
    emoji: c.emoji || "💬",
    col: c.color || "#7c6ba8",
    color: c.color || "#7c6ba8",
    image: c.image || "",
    members: c.memberCount || 0,
    memberCount: c.memberCount || 0,
    avs: c.avatarColors?.length ? c.avatarColors : DEFAULT_AVS,
    joined,
    unlocked,
    slug: c.slug,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

exports.listCommunitiesForUser = async (userId) => {
  const communities = await Community.find({
    isDeleted: false,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  const unlocked = userId ? await hasCommunityAccess(userId) : false;
  const unlockAmount = await getUnlockAmount();

  const countRows = await CommunityMembership.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$communityId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(
    countRows.map((r) => [String(r._id), r.count]),
  );

  let joinedIds = new Set();
  if (userId) {
    const memberships = await CommunityMembership.find({
      userId,
      isDeleted: false,
    })
      .select("communityId")
      .lean();
    joinedIds = new Set(memberships.map((m) => String(m.communityId)));
  }

  return {
    unlocked,
    unlockAmount,
    communities: communities.map((c) => {
      const realCount = countMap[String(c._id)] ?? 0;
      return exports.formatCommunity(
        { ...c, memberCount: realCount },
        {
          joined: joinedIds.has(String(c._id)),
          unlocked,
        },
      );
    }),
  };
};

exports.getCommunityDetailForUser = async (communityId, userId) => {
  const community = await Community.findOne({
    _id: communityId,
    isDeleted: false,
  }).lean();
  if (!community) {
    throwError(404, "Community not found");
  }

  const unlocked = userId ? await hasCommunityAccess(userId) : false;
  let joined = false;
  if (userId) {
    joined = Boolean(
      await CommunityMembership.exists({
        userId,
        communityId,
        isDeleted: false,
      }),
    );
  }

  const realCount = await CommunityMembership.countDocuments({
    communityId,
    isDeleted: false,
  });

  return exports.formatCommunity(
    { ...community, memberCount: realCount },
    { joined, unlocked },
  );
};
