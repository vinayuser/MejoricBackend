const express = require("express");
const router = express.Router();
const {
  sendMessage,
  initiateChat,
  getChatHistory,
  getAllChatHistory,
  acceptChat,
  rejectChat,
} = require("../controllers/chat.controller");
const { verifyJwtToken } = require("../middlewares/index");

router.post("/send", verifyJwtToken, sendMessage);
router.post("/initiate", verifyJwtToken, initiateChat);
router.post("/accept", verifyJwtToken, acceptChat);
router.post("/reject", verifyJwtToken, rejectChat);
router.post(
  "/end",
  verifyJwtToken,
  require("../controllers/chat.controller").endChat,
);
router.get("/all-history", verifyJwtToken, getAllChatHistory);
router.get("/history", verifyJwtToken, getChatHistory);

module.exports = router;
