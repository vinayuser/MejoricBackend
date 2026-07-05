const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { getISTDayKey } = require("../../helpers/istDate");
const {
  getTrackingOverview,
  getOnlineMatesPaginated,
  getActivityLogPaginated,
  getMateSummaryPaginated,
  getMateDailyServiceStats,
} = require("../../services/mateAvailability/trackingQueries");

const parseListQuery = (req) => ({
  dateKey: req.query.date || getISTDayKey(),
  page: parseInt(req.query.page, 10) || 1,
  limit: parseInt(req.query.limit, 10) || 10,
  search: req.query.search || "",
});

exports.getOverview = asyncWrapper(async (req, res) => {
  const dateKey = req.query.date || getISTDayKey();
  const overview = await getTrackingOverview(dateKey);
  return sendSuccess(res, 200, "Tracking overview fetched", overview);
});

exports.getOnlineMates = asyncWrapper(async (req, res) => {
  const result = await getOnlineMatesPaginated(parseListQuery(req));
  return sendSuccess(res, 200, "Online mates fetched", result);
});

exports.getActivityLog = asyncWrapper(async (req, res) => {
  const result = await getActivityLogPaginated(parseListQuery(req));
  return sendSuccess(res, 200, "Activity log fetched", result);
});

exports.getMateSummary = asyncWrapper(async (req, res) => {
  const result = await getMateSummaryPaginated(parseListQuery(req));
  return sendSuccess(res, 200, "Mate summary fetched", result);
});

exports.getMateDailyStats = asyncWrapper(async (req, res) => {
  const { mateUserId } = req.params;
  validateObjectId(mateUserId, "Mate user ID");
  const dateKey = req.query.date || getISTDayKey();
  const stats = await getMateDailyServiceStats(mateUserId, dateKey);
  if (!stats) throwError(404, "Mate not found");
  return sendSuccess(res, 200, "Mate daily stats fetched", stats);
});
