const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const {
  createCohort,
  updateCohort,
  deleteCohort,
  getCohortById,
  listCohortsAdmin,
  formatCohortPublic,
  listTherapyForUser,
  createTherapyOrder,
  verifyTherapyPayment,
  enrollWithWallet,
  getMyEnrollments,
  getTherapySessionJoin,
} = require("../../services/therapy");

/** Admin */
exports.createCohort = asyncWrapper(async (req, res) => {
  const cohort = await createCohort(req.body || {});
  return sendSuccess(res, 201, "Cohort created", cohort);
});

exports.updateCohort = asyncWrapper(async (req, res) => {
  const cohort = await updateCohort(req.params.id, req.body || {});
  return sendSuccess(res, 200, "Cohort updated", cohort);
});

exports.deleteCohort = asyncWrapper(async (req, res) => {
  await deleteCohort(req.params.id);
  return sendSuccess(res, 200, "Cohort deleted");
});

exports.getCohortAdmin = asyncWrapper(async (req, res) => {
  const cohort = await getCohortById(req.params.id);
  return sendSuccess(res, 200, "Cohort fetched", cohort);
});

exports.listCohortsAdmin = asyncWrapper(async (req, res) => {
  const result = await listCohortsAdmin(req.query);
  return sendSuccess(res, 200, "Cohorts fetched", result);
});

/** User */
exports.listTherapy = asyncWrapper(async (req, res) => {
  const result = await listTherapyForUser(req.userId);
  return sendSuccess(res, 200, "Therapy cohorts", result);
});

exports.myEnrollments = asyncWrapper(async (req, res) => {
  const data = await getMyEnrollments(req.userId);
  return sendSuccess(res, 200, "My enrollments", data);
});

exports.enrollWallet = asyncWrapper(async (req, res) => {
  const cohortId = req.params.id;
  const result = await enrollWithWallet(req.userId, cohortId);
  if (result.requiresPayment) {
    return sendSuccess(res, 200, "Razorpay payment required", result);
  }
  return sendSuccess(res, 200, "Enrolled in group therapy", result);
});

exports.createOrder = asyncWrapper(async (req, res) => {
  const order = await createTherapyOrder(req.userId, req.params.id);
  return sendSuccess(res, 200, "Payment order created", order);
});

exports.verifyPayment = asyncWrapper(async (req, res) => {
  const result = await verifyTherapyPayment(req.userId, req.body || {});
  return sendSuccess(
    res,
    200,
    result.alreadyProcessed
      ? "Already enrolled"
      : result.waitlisted
        ? "Added to waitlist"
        : "Enrollment confirmed",
    result,
  );
});

exports.joinSession = asyncWrapper(async (req, res) => {
  const { enrollmentId } = req.params;
  const slotId = req.query.slot || req.body?.slotId;
  const session = await getTherapySessionJoin(
    req.userId,
    enrollmentId,
    slotId,
  );
  return sendSuccess(res, 200, "Join authorized", session);
});

exports.getCohortPublic = asyncWrapper(async (req, res) => {
  const cohort = await getCohortById(req.params.id);
  if (!cohort.isActive) throwError(404, "Cohort not found");
  return sendSuccess(
    res,
    200,
    "Cohort",
    formatCohortPublic(cohort, { enrolled: false }),
  );
});
