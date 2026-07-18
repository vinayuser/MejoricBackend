const express = require("express");
const { register } = require("../controllers/auth");
const { updateUser } = require("../controllers/users");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

const attachUserIdFromParams = (req, res, next) => {
  req.query = { ...req.query, userId: req.params.id };
  next();
};

const prepareMateCreate = (req, res, next) => {
  req.body.role = "mate";
  req.body.agreedToTerms = req.body.agreedToTerms ?? true;
  next();
};

router.post("/create", verifyJwtToken, isAdmin, prepareMateCreate, register);
router.put("/update/:id", verifyJwtToken, isAdmin, attachUserIdFromParams, updateUser);

module.exports = { router, routePrefix: "/mates" };
