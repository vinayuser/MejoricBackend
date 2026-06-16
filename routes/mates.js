const express = require("express");
const { register } = require("../controllers/auth");
const { updateUser } = require("../controllers/users");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

const attachUserIdFromParams = (req, res, next) => {
  req.query = { ...req.query, userId: req.params.id };
  next();
};

router.post("/create", verifyJwtToken, isAdmin, register);
router.put("/update/:id", verifyJwtToken, isAdmin, attachUserIdFromParams, updateUser);

module.exports = { router, routePrefix: "/mates" };
