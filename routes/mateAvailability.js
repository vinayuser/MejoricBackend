const express = require("express");
const {
  getOverview,
  getOnlineMates,
  getActivityLog,
  getMateSummary,
  getMateDailyStats,
} = require("../controllers/mateAvailability");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

router.get("/tracking/overview", verifyJwtToken, isAdmin, getOverview);
router.get("/tracking/online", verifyJwtToken, isAdmin, getOnlineMates);
router.get("/tracking/activity", verifyJwtToken, isAdmin, getActivityLog);
router.get("/tracking/summary", verifyJwtToken, isAdmin, getMateSummary);
router.get(
  "/tracking/:mateUserId/daily-stats",
  verifyJwtToken,
  isAdmin,
  getMateDailyStats,
);

module.exports = { router, routePrefix: "/mate-availability" };
