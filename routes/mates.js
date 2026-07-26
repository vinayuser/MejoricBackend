const express = require("express");
const { register } = require("../controllers/auth");
const { updateUser } = require("../controllers/users");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

// Express 5: req.query is a getter — reassigning it is ignored.
const attachUserIdFromParams = (req, res, next) => {
  req.targetUserId = req.params.id;
  next();
};

router.post("/create", verifyJwtToken, isAdmin, register);
router.put("/update/:id", verifyJwtToken, isAdmin, attachUserIdFromParams, updateUser);

module.exports = { router, routePrefix: "/mates" };
