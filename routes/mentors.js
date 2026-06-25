const express = require("express");
const { register } = require("../controllers/auth");
const { updateUser } = require("../controllers/users");
const {
  getAllMentors,
  getMentorById,
  resetMentorPassword,
} = require("../controllers/mentors");
const { verifyJwtToken, isAdmin } = require("../middlewares");

const router = express.Router();

const attachUserIdFromParams = (req, res, next) => {
  req.query = { ...req.query, userId: req.params.id };
  next();
};

const prepareMentorCreate = (req, res, next) => {
  req.body.role = "mentor";
  req.body.agreedToTerms = req.body.agreedToTerms ?? true;
  next();
};

router.get("/getAll", verifyJwtToken, isAdmin, getAllMentors);
router.get("/get/:id", verifyJwtToken, isAdmin, getMentorById);
router.post("/create", verifyJwtToken, isAdmin, prepareMentorCreate, register);
router.put("/update/:id", verifyJwtToken, isAdmin, attachUserIdFromParams, updateUser);
router.put("/reset-password/:id", verifyJwtToken, isAdmin, resetMentorPassword);

module.exports = { router, routePrefix: "/mentors" };
