const express = require("express");
const router = express.Router();

const {
  createWalletTopupOrder,
  verifyWalletTopup,
  getWallet,
  getWalletHistory,
  getAdminWalletHistory,
  webhookHandler,
} = require("../controllers/wallet");
const { verifyJwtToken } = require("../middlewares/verifyJwtToken");
const { validateRoles } = require("../middlewares/validateRoles");

// User routes
router.post("/order/create", verifyJwtToken, createWalletTopupOrder);
router.post("/verify", verifyJwtToken, verifyWalletTopup);
router.get("/", verifyJwtToken, getWallet);
router.get("/history", verifyJwtToken, getWalletHistory);

// Admin routes
router.get(
  "/admin/history",
  verifyJwtToken,
  validateRoles(["ADMIN"]),
  getAdminWalletHistory,
);

// Razorpay webhook (no auth)
router.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  webhookHandler,
);

module.exports = router;
