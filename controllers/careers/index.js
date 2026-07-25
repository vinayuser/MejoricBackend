const { asyncWrapper, sendSuccess } = require("../../utils");
const careers = require("../../services/careers");

exports.createJob = asyncWrapper(async (req, res) => {
  const job = await careers.createJob(req.body || {});
  return sendSuccess(res, 201, "Job created", job);
});

exports.updateJob = asyncWrapper(async (req, res) => {
  const job = await careers.updateJob(req.params.id, req.body || {});
  return sendSuccess(res, 200, "Job updated", job);
});

exports.deleteJob = asyncWrapper(async (req, res) => {
  const result = await careers.deleteJob(req.params.id);
  return sendSuccess(res, 200, "Job deleted", result);
});

exports.getJobAdmin = asyncWrapper(async (req, res) => {
  const job = await careers.getJobAdmin(req.params.id);
  return sendSuccess(res, 200, "Job fetched", job);
});

exports.listJobsAdmin = asyncWrapper(async (req, res) => {
  const result = await careers.listJobsAdmin(req.query);
  return sendSuccess(res, 200, "Jobs fetched", result);
});

exports.listJobsPublic = asyncWrapper(async (req, res) => {
  const result = await careers.listJobsPublic(req.query);
  return sendSuccess(res, 200, "Jobs fetched", result);
});

exports.getJobPublic = asyncWrapper(async (req, res) => {
  const job = await careers.getJobPublic(req.params.id);
  return sendSuccess(res, 200, "Job fetched", job);
});

exports.applyToJob = asyncWrapper(async (req, res) => {
  const cv = req.files?.cv || req.files?.resume || req.files?.file;
  const result = await careers.applyToJob(req.params.id, req.body || {}, cv);
  return sendSuccess(res, 201, "Application submitted", result);
});

exports.listApplicationsAdmin = asyncWrapper(async (req, res) => {
  const result = await careers.listApplicationsAdmin(req.query);
  return sendSuccess(res, 200, "Applications fetched", result);
});

exports.updateApplicationStatus = asyncWrapper(async (req, res) => {
  const result = await careers.updateApplicationStatus(
    req.params.id,
    req.body?.status,
  );
  return sendSuccess(res, 200, "Application updated", result);
});
