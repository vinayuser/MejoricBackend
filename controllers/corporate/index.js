const { asyncWrapper, sendSuccess, sendTokenResponse } = require("../../utils");
const corporate = require("../../services/corporate");
const { getCorporateUsageSummary, getCorporateForUser } = require("../../helpers/corporateBilling.helper");

exports.createCorporate = asyncWrapper(async (req, res) => {
  const doc = await corporate.createCorporate(req.body || {});
  return sendSuccess(res, 201, "Corporate account created", doc);
});

exports.updateCorporate = asyncWrapper(async (req, res) => {
  const doc = await corporate.updateCorporate(req.params.id, req.body || {});
  return sendSuccess(res, 200, "Corporate account updated", doc);
});

exports.deleteCorporate = asyncWrapper(async (req, res) => {
  const result = await corporate.deleteCorporate(req.params.id);
  return sendSuccess(res, 200, "Corporate account deleted", result);
});

exports.getCorporateAdmin = asyncWrapper(async (req, res) => {
  const doc = await corporate.getCorporateAdmin(req.params.id);
  return sendSuccess(res, 200, "Corporate account fetched", doc);
});

exports.listCorporatesAdmin = asyncWrapper(async (req, res) => {
  const result = await corporate.listCorporatesAdmin(req.query);
  return sendSuccess(res, 200, "Corporate accounts fetched", result);
});

exports.getBillingOverview = asyncWrapper(async (req, res) => {
  const data = await corporate.getBillingOverview();
  return sendSuccess(res, 200, "Corporate billing overview fetched", data);
});

exports.getCorporateDashboard = asyncWrapper(async (req, res) => {
  const data = await corporate.getCorporateDashboard(req.params.id);
  return sendSuccess(res, 200, "Corporate dashboard fetched", data);
});

exports.listInvoices = asyncWrapper(async (req, res) => {
  const data = await corporate.listInvoices(req.params.id, req.query);
  return sendSuccess(res, 200, "Invoices fetched", data);
});

exports.generateInvoice = asyncWrapper(async (req, res) => {
  const doc = await corporate.generateInvoice(req.params.id, req.body || {});
  return sendSuccess(res, 201, "Invoice generated", doc);
});

exports.recordPayment = asyncWrapper(async (req, res) => {
  const doc = await corporate.recordPayment(
    req.params.invoiceId,
    req.body || {},
    req.userId,
  );
  return sendSuccess(res, 200, "Payment recorded", doc);
});

exports.cancelInvoice = asyncWrapper(async (req, res) => {
  const doc = await corporate.cancelInvoice(req.params.invoiceId);
  return sendSuccess(res, 200, "Invoice cancelled", doc);
});

exports.listUsageLogs = asyncWrapper(async (req, res) => {
  const data = await corporate.listUsageLogs(req.params.id, req.query);
  return sendSuccess(res, 200, "Usage logs fetched", data);
});

exports.listMembers = asyncWrapper(async (req, res) => {
  const data = await corporate.listMembers(req.params.id, req.query);
  return sendSuccess(res, 200, "Corporate members fetched", data);
});

exports.listActiveCorporatesPublic = asyncWrapper(async (req, res) => {
  const list = await corporate.listActiveCorporatesPublic();
  return sendSuccess(res, 200, "Companies fetched", list);
});

exports.sendCorporateOtp = asyncWrapper(async (req, res) => {
  const data = await corporate.sendCorporateOtp(req.body || {});
  return sendSuccess(res, 200, "OTP sent to your email", data);
});

exports.verifyCorporateOtp = asyncWrapper(async (req, res) => {
  const user = await corporate.verifyCorporateOtp(req.body || {});
  const usage = await getCorporateForUser(user._id);
  const corporateUsage = getCorporateUsageSummary(usage);
  return sendTokenResponse(res, 200, "Corporate login successful", user, {
    corporateUsage,
  });
});

exports.getMyCorporateUsage = asyncWrapper(async (req, res) => {
  const usage = await corporate.getMyCorporateUsage(req.userId);
  return sendSuccess(res, 200, "Corporate usage fetched", usage);
});
