const express = require("express");
const router = express.Router();

const {
  isAdmin,
  verifyJwtToken,
  optionalVerifyJwtToken,
} = require("../middlewares");
const {
  createCohort,
  updateCohort,
  deleteCohort,
  getCohortAdmin,
  listCohortsAdmin,
  listTherapy,
  myEnrollments,
  enrollWallet,
  createOrder,
  verifyPayment,
  joinSession,
  getCohortPublic,
} = require("../controllers/therapy");

/** Admin */
router.post("/admin/create", isAdmin, createCohort);
router.get("/admin/getAll", isAdmin, listCohortsAdmin);
router.get("/admin/get/:id", isAdmin, getCohortAdmin);
router.put("/admin/update/:id", isAdmin, updateCohort);
router.delete("/admin/delete/:id", isAdmin, deleteCohort);

/** User */
router.get("/list", optionalVerifyJwtToken, listTherapy);
router.get("/my-enrollments", verifyJwtToken, myEnrollments);
router.get("/cohort/:id", optionalVerifyJwtToken, getCohortPublic);

router.post("/:id/enroll-wallet", verifyJwtToken, enrollWallet);
router.post("/:id/order/create", verifyJwtToken, createOrder);
router.post("/verify-payment", verifyJwtToken, verifyPayment);

/** Purchase-gated join (platform only) */
router.get(
  "/enrollments/:enrollmentId/join",
  verifyJwtToken,
  joinSession,
);

module.exports = router;
