const CommunityPost = require("../../models/CommunityPost");
const CommunityMessage = require("../../models/CommunityMessage");
const CommunityMembership = require("../../models/CommunityMembership");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { hasCommunityAccess } = require("./accessHelpers");
const { getUserDisplayName } = require("../../helpers/userDisplayName.helper");
const { cleanCommunityText } = require("../../helpers/communityTextFilter");

async function assertMemberAndUnlocked(userId, communityId) {
  const unlocked = await hasCommunityAccess(userId);
  if (!unlocked) {
    throwError(402, "Community unlock required");
  }
  const member = await CommunityMembership.exists({
    userId,
    communityId,
    isDeleted: false,
  });
  if (!member) {
    throwError(403, "Join this community to post or chat");
  }
}

function formatAuthor(user, isAnonymous) {
  if (isAnonymous) {
    return { displayName: "Anonymous", isAnonymous: true, avatarInitial: "A" };
  }
  const name = getUserDisplayName(user, "Member");
  return {
    displayName: name,
    isAnonymous: false,
    avatarInitial: String(name).charAt(0).toUpperCase() || "M",
    userId: user?._id,
  };
}

exports.listPosts = async (userId, communityId, { page = 1, limit = 30 } = {}) => {
  await assertMemberAndUnlocked(userId, communityId);
  page = Number(page) || 1;
  limit = Math.min(Number(limit) || 30, 100);
  const skip = (page - 1) * limit;

  const [total, posts] = await Promise.all([
    CommunityPost.countDocuments({ communityId, isDeleted: false }),
    CommunityPost.find({ communityId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const authorIds = [...new Set(posts.map((p) => String(p.authorId)))];
  const users = await User.find({ _id: { $in: authorIds } })
    .select("name email")
    .lean();
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  return {
    total,
    page,
    limit,
    data: posts.map((p) => ({
      id: String(p._id),
      communityId: String(p.communityId),
      content: p.content,
      createdAt: p.createdAt,
      author: formatAuthor(userMap[String(p.authorId)], p.isAnonymous),
    })),
  };
};

exports.createPost = async (userId, communityId, { content, isAnonymous = false }) => {
  await assertMemberAndUnlocked(userId, communityId);
  const text = cleanCommunityText(String(content || "").trim());
  if (!text) throwError(422, "Post content is required");
  if (text.length > 5000) throwError(422, "Post is too long");

  const post = await CommunityPost.create({
    communityId,
    authorId: userId,
    content: text,
    isAnonymous: isAnonymous === true || isAnonymous === "true",
  });

  const user = await User.findById(userId).select("name email").lean();
  return {
    id: String(post._id),
    communityId: String(post.communityId),
    content: post.content,
    createdAt: post.createdAt,
    author: formatAuthor(user, post.isAnonymous),
  };
};

exports.listMessages = async (
  userId,
  communityId,
  { page = 1, limit = 50, before } = {},
) => {
  await assertMemberAndUnlocked(userId, communityId);
  page = Number(page) || 1;
  limit = Math.min(Number(limit) || 50, 100);
  const skip = (page - 1) * limit;

  const match = { communityId, isDeleted: false };
  if (before) match.createdAt = { $lt: new Date(before) };

  const [total, messages] = await Promise.all([
    CommunityMessage.countDocuments(match),
    CommunityMessage.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const users = await User.find({ _id: { $in: authorIds } })
    .select("name email")
    .lean();
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const data = messages
    .map((m) => ({
      id: String(m._id),
      communityId: String(m.communityId),
      text: m.text,
      createdAt: m.createdAt,
      author: formatAuthor(userMap[String(m.authorId)], m.isAnonymous),
      isMine: String(m.authorId) === String(userId),
      authorId: String(m.authorId),
    }))
    .reverse();

  return { total, page, limit, data };
};

exports.createMessage = async (
  userId,
  communityId,
  { text, isAnonymous = false },
) => {
  await assertMemberAndUnlocked(userId, communityId);
  const body = cleanCommunityText(String(text || "").trim());
  if (!body) throwError(422, "Message text is required");
  if (body.length > 2000) throwError(422, "Message is too long");

  const message = await CommunityMessage.create({
    communityId,
    authorId: userId,
    text: body,
    isAnonymous: isAnonymous === true || isAnonymous === "true",
  });

  const user = await User.findById(userId).select("name email").lean();
  return {
    id: String(message._id),
    communityId: String(message.communityId),
    authorId: String(userId),
    text: message.text,
    createdAt: message.createdAt,
    author: formatAuthor(user, message.isAnonymous),
    isMine: true,
  };
};
