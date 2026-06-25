const {
  asyncWrapper,
  sendSuccess,
  throwError,
  cleanJoiError,
  validateObjectId,
} = require("../../utils");
const mongoose = require("mongoose");
const { ROLES } = require("../../constants");
const {
  createBooking,
  getBookedSlotIds,
  getAdminBookings,
  getPublicAvailableSlots,
  getPublicAvailableDates,
  getMentorAvailability,
  saveMentorAvailability,
  getMentorAppointments,
  getUserBookings,
} = require("../../services/bookings");
const {
  validateCreateBooking,
  validateAdminBookingsQuery,
  validateBookedSlotsQuery,
  validateAvailabilityQuery,
  validateSaveAvailability,
  validateMentorAppointmentsQuery,
  validateAvailableDatesQuery,
  validateUserBookingsQuery,
} = require("../../validator/bookings");

function ensureMentor(req) {
  if (req.role !== ROLES.MENTOR) {
    throwError(403, "Only mentors can access this resource");
  }
}

exports.createBooking = asyncWrapper(async (req, res) => {
  const { error, value } = validateCreateBooking(req.body);
  if (error) throwError(422, cleanJoiError(error));

  validateObjectId(value.mentorId, "Mentor ID");

  const booking = await createBooking({
    ...value,
    userId: req.userId || null,
  });

  return sendSuccess(res, 201, "Appointment booked successfully", booking);
});

exports.getBookedSlots = asyncWrapper(async (req, res) => {
  const { error, value } = validateBookedSlotsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  validateObjectId(req.params.mentorId, "Mentor ID");

  const slotIds = await getBookedSlotIds(req.params.mentorId, value.dateKey);
  return sendSuccess(res, 200, "Booked slots fetched", { slotIds });
});

exports.getPublicAvailability = asyncWrapper(async (req, res) => {
  const { error, value } = validateAvailabilityQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const { mentorId } = req.params;
  if (!mentorId || mentorId === "me" || !mongoose.Types.ObjectId.isValid(mentorId)) {
    return sendSuccess(res, 200, "Available slots fetched", { slots: [] });
  }

  const slots = await getPublicAvailableSlots(mentorId, value.dateKey);
  return sendSuccess(res, 200, "Available slots fetched", { slots });
});

exports.getPublicAvailableDates = asyncWrapper(async (req, res) => {
  const { error, value } = validateAvailableDatesQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  validateObjectId(req.params.mentorId, "Mentor ID");

  const dates = await getPublicAvailableDates(
    req.params.mentorId,
    value.year,
    value.month,
  );
  return sendSuccess(res, 200, "Available dates fetched", { dates });
});

exports.getMyAvailability = asyncWrapper(async (req, res) => {
  ensureMentor(req);

  const { error, value } = validateAvailabilityQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const data = await getMentorAvailability(req.userId, value.dateKey);
  return sendSuccess(res, 200, "Availability fetched", data);
});

exports.saveMyAvailability = asyncWrapper(async (req, res) => {
  ensureMentor(req);

  const { error, value } = validateSaveAvailability(req.body);
  if (error) throwError(422, cleanJoiError(error));

  const data = await saveMentorAvailability(
    req.userId,
    value.dateKey,
    value.slotIds,
  );
  return sendSuccess(res, 200, "Availability saved", data);
});

exports.getMyAppointments = asyncWrapper(async (req, res) => {
  ensureMentor(req);

  const { error, value } = validateMentorAppointmentsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const result = await getMentorAppointments(req.userId, value);
  return sendSuccess(res, 200, "Appointments fetched", result);
});

exports.getMyBookings = asyncWrapper(async (req, res) => {
  const { error, value } = validateUserBookingsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const result = await getUserBookings(req.userId, value);
  return sendSuccess(res, 200, "Bookings fetched", result);
});

exports.getAdminBookings = asyncWrapper(async (req, res) => {
  const { error, value } = validateAdminBookingsQuery(req.query);
  if (error) throwError(422, cleanJoiError(error));

  const result = await getAdminBookings(value);
  return sendSuccess(res, 200, "Bookings fetched successfully", result);
});
