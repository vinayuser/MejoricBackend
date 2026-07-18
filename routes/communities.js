const express = require("express");
const router = express.Router();

const {
  isAdmin,
  verifyJwtToken,
  optionalVerifyJwtToken,
} = require("../middlewares");
const {
  createCommunity,
  getAllCommunitiesAdmin,
  getCommunityAdmin,
  updateCommunity,
  deleteCommunity,
  listCommunities,
  getCommunity,
  getAccessStatus,
  unlockWithWallet,
  createUnlockOrder,
  verifyUnlockPayment,
  joinCommunity,
  leaveCommunity,
  listPosts,
  createPost,
  listMessages,
  createMessage,
  getPricing,
  updatePricing,
} = require("../controllers/communities");

/** Admin CRUD */
router.post("/create", isAdmin, createCommunity);
router.get("/admin/getAll", isAdmin, getAllCommunitiesAdmin);
router.get("/admin/get/:id", isAdmin, getCommunityAdmin);
router.put("/update/:id", isAdmin, updateCommunity);
router.delete("/delete/:id", isAdmin, deleteCommunity);
router.get("/admin/pricing", isAdmin, getPricing);
router.put("/admin/pricing", isAdmin, updatePricing);

/** Access / unlock */
router.get("/access/status", verifyJwtToken, getAccessStatus);
router.post("/access/unlock", verifyJwtToken, unlockWithWallet);
router.post("/access/create-order", verifyJwtToken, createUnlockOrder);
router.post("/access/verify", verifyJwtToken, verifyUnlockPayment);

/** Public list (joined flags if logged in) */
router.get("/list", optionalVerifyJwtToken, listCommunities);
router.get("/get/:id", optionalVerifyJwtToken, getCommunity);

/** Membership */
router.post("/:id/join", verifyJwtToken, joinCommunity);
router.post("/:id/leave", verifyJwtToken, leaveCommunity);

/** Feed + chat */
router.get("/:id/posts", verifyJwtToken, listPosts);
router.post("/:id/posts", verifyJwtToken, createPost);
router.get("/:id/messages", verifyJwtToken, listMessages);
router.post("/:id/messages", verifyJwtToken, createMessage);

module.exports = router;
