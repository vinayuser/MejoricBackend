const express = require("express");
const router = express.Router();
const { getDashboard, getFinancials } = require("../controllers/dashboard/index");
const { verifyJwtToken } = require("../middlewares");

// Route: GET /dashboard/stats
// Desc: Get dashboard data
// Access: Private (Admin)
router.get("/stats", verifyJwtToken, getDashboard);

// Route: GET /dashboard/financials
// Desc: Get detailed financial analytics for recharges, spends, and mate call earnings
// Access: Private (Admin)
router.get("/financials", verifyJwtToken, getFinancials);

module.exports = router;
