const express = require("express");
const { sendBulkSms } = require("../controllers/sms/sendBulkSms");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

router.post("/bulk", verifyJwtToken, isAdmin, sendBulkSms);

module.exports = { router, routePrefix: "/sms" };
