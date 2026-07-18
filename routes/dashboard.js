const express = require("express");
const router = express.Router();
const {
  getDashboard,
  getFinancials,
  getFinancialTransactions,
  getFinancialUsers,
  getFinancialSessions,
} = require("../controllers/dashboard/index");
const { verifyJwtToken } = require("../middlewares");

router.get("/stats", verifyJwtToken, getDashboard);
router.get("/financials", verifyJwtToken, getFinancials);
router.get("/financials/transactions", verifyJwtToken, getFinancialTransactions);
router.get("/financials/users", verifyJwtToken, getFinancialUsers);
router.get("/financials/sessions", verifyJwtToken, getFinancialSessions);

module.exports = router;
