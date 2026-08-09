const express = require("express");
const { verifyJwtToken, isAdmin, validateRoles } = require("../middlewares");
const { ROLES } = require("../constants");
const {
  blockIp,
  listBlockedIps,
  unblockIp,
} = require("../controllers/moderation/blockIp");

const router = express.Router();

const isMateOrMentor = validateRoles(ROLES.MATE, ROLES.MENTOR);

router.post("/block-ip", verifyJwtToken, isMateOrMentor, blockIp);
router.get("/blocked-ips", verifyJwtToken, isAdmin, listBlockedIps);
router.post("/unblock-ip", verifyJwtToken, isAdmin, unblockIp);

module.exports = { router, routePrefix: "/moderation" };
