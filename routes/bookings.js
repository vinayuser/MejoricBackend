const express = require("express");
const router = express.Router();

const {
  createBooking,
  getBookedSlots,
  getPublicAvailability,
  getPublicAvailableDates,
  getMyAvailability,
  saveMyAvailability,
  getMyAppointments,
  getMyBookings,
  getAdminBookings,
} = require("../controllers/bookings");
const { verifyJwtToken, isAdmin, optionalVerifyJwtToken } = require("../middlewares");

router.post("/create", optionalVerifyJwtToken, createBooking);

// Static "me" routes must come before :mentorId param routes
router.get("/me", verifyJwtToken, getMyBookings);
router.get("/mentor/me/availability", verifyJwtToken, getMyAvailability);
router.put("/mentor/me/availability", verifyJwtToken, saveMyAvailability);
router.get("/mentor/me/appointments", verifyJwtToken, getMyAppointments);

router.get("/mentor/:mentorId/booked-slots", getBookedSlots);
router.get("/mentor/:mentorId/availability", getPublicAvailability);
router.get("/mentor/:mentorId/available-dates", getPublicAvailableDates);

router.get("/admin/list", verifyJwtToken, isAdmin, getAdminBookings);

module.exports = router;
