const express = require("express");
const router = express.Router();

const {
  getUser,
  getUserByIdParam,
  getPublicMateProfile,
  getAllUsers,
  updateUser,
  deleteUser,
  updateFcmToken,
  clearMateBusy,
} = require("../controllers/users");
const { verifyJwtToken } = require("../middlewares");

router.get("/get", verifyJwtToken, getUser);
router.get("/get/:id", verifyJwtToken, getUserByIdParam);
router.get("/profile/:id", getPublicMateProfile);
// Public list (e.g. consumer app browse mates). Admin panel relies on app-level access;
// use optional future: separate admin-only route if you need stricter server enforcement.
router.get("/getAll", getAllUsers);
router.put("/mate/clear-busy", clearMateBusy);
router.post("/fcm-token", verifyJwtToken, updateFcmToken);
router.put("/update", verifyJwtToken, updateUser);
router.delete("/delete", verifyJwtToken, deleteUser);

module.exports = router;
