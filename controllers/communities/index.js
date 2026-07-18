const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const {
  createCommunity,
  getAllCommunitiesAdmin,
  getCommunityById,
  updateCommunityById,
  deleteCommunityById,
  listCommunitiesForUser,
  getCommunityDetailForUser,
  joinCommunity,
  leaveCommunity,
  getAccessStatus,
  unlockWithWallet,
  createCommunityUnlockOrder,
  verifyCommunityUnlockPayment,
  listPosts,
  createPost,
  listMessages,
  createMessage,
} = require("../../services/communities");
const {
  getCommunityUnlockAmount,
  setCommunityUnlockAmount,
} = require("../../services/platformSettings");
const { getIO } = require("../../helpers/socket");
const { roomName: communityRoomName } = require("../../helpers/communityPresence");

/** Admin */
exports.createCommunity = asyncWrapper(async (req, res) => {
  if (!req.body?.name?.trim()) throwError(422, "Name is required");
  const image = req.files?.image;
  const community = await createCommunity(req.body, image);
  return sendSuccess(res, 201, "Community created", community);
});

exports.getAllCommunitiesAdmin = asyncWrapper(async (req, res) => {
  const result = await getAllCommunitiesAdmin(req.query);
  return sendSuccess(res, 200, "Communities fetched", result);
});

exports.getCommunityAdmin = asyncWrapper(async (req, res) => {
  const community = await getCommunityById(req.params.id);
  return sendSuccess(res, 200, "Community fetched", community);
});

exports.updateCommunity = asyncWrapper(async (req, res) => {
  const image = req.files?.image;
  const updated = await updateCommunityById(req.params.id, req.body, image);
  return sendSuccess(res, 200, "Community updated", updated);
});

exports.deleteCommunity = asyncWrapper(async (req, res) => {
  await deleteCommunityById(req.params.id);
  return sendSuccess(res, 200, "Community deleted successfully");
});

exports.getPricing = asyncWrapper(async (req, res) => {
  const unlockAmount = await getCommunityUnlockAmount();
  return sendSuccess(res, 200, "Community pricing", { unlockAmount });
});

exports.updatePricing = asyncWrapper(async (req, res) => {
  const unlockAmount = await setCommunityUnlockAmount(
    req.body?.unlockAmount,
    req.userId,
  );
  return sendSuccess(res, 200, "Community unlock price updated", {
    unlockAmount: unlockAmount.value,
  });
});

/** User-facing */
exports.listCommunities = asyncWrapper(async (req, res) => {
  const result = await listCommunitiesForUser(req.userId);
  return sendSuccess(res, 200, "Communities fetched", result);
});

exports.getCommunity = asyncWrapper(async (req, res) => {
  const community = await getCommunityDetailForUser(req.params.id, req.userId);
  return sendSuccess(res, 200, "Community fetched", community);
});

exports.getAccessStatus = asyncWrapper(async (req, res) => {
  const status = await getAccessStatus(req.userId);
  return sendSuccess(res, 200, "Access status", status);
});

exports.unlockWithWallet = asyncWrapper(async (req, res) => {
  const result = await unlockWithWallet(req.userId);
  if (result.requiresPayment) {
    return sendSuccess(res, 200, "Razorpay payment required", result);
  }
  return sendSuccess(res, 200, "Community unlocked", result);
});

exports.createUnlockOrder = asyncWrapper(async (req, res) => {
  const order = await createCommunityUnlockOrder(req.userId);
  return sendSuccess(res, 200, "Payment order created", order);
});

exports.verifyUnlockPayment = asyncWrapper(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throwError(422, "razorpayOrderId, razorpayPaymentId and razorpaySignature are required");
  }
  const result = await verifyCommunityUnlockPayment(req.userId, req.body);
  return sendSuccess(
    res,
    200,
    result.alreadyUnlocked
      ? "Community already unlocked"
      : "Community unlocked",
    result,
  );
});

exports.joinCommunity = asyncWrapper(async (req, res) => {
  const community = await joinCommunity(req.userId, req.params.id);
  return sendSuccess(res, 200, "Joined community", community);
});

exports.leaveCommunity = asyncWrapper(async (req, res) => {
  const community = await leaveCommunity(req.userId, req.params.id);
  return sendSuccess(res, 200, "Left community", community);
});

exports.listPosts = asyncWrapper(async (req, res) => {
  const result = await listPosts(req.userId, req.params.id, req.query);
  return sendSuccess(res, 200, "Posts fetched", result);
});

exports.createPost = asyncWrapper(async (req, res) => {
  const post = await createPost(req.userId, req.params.id, req.body || {});
  return sendSuccess(res, 201, "Post created", post);
});

exports.listMessages = asyncWrapper(async (req, res) => {
  const result = await listMessages(req.userId, req.params.id, req.query);
  return sendSuccess(res, 200, "Messages fetched", result);
});

exports.createMessage = asyncWrapper(async (req, res) => {
  const message = await createMessage(req.userId, req.params.id, req.body || {});
  const io = getIO();
  if (io) {
    const communityId = String(req.params.id);
    const { isMine: _mine, ...publicMessage } = message;
    io.to(communityRoomName(communityId)).emit("community_new_message", {
      communityId,
      message: publicMessage,
    });
  }
  return sendSuccess(res, 201, "Message sent", message);
});
