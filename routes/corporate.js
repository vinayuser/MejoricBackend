const express = require("express");
const router = express.Router();
const { isAdmin, verifyJwtToken } = require("../middlewares");
const { requireCorporateOwner } = require("../middlewares/requireCorporateOwner");
const {
  createCorporate,
  updateCorporate,
  deleteCorporate,
  getCorporateAdmin,
  listCorporatesAdmin,
  getBillingOverview,
  getCorporateDashboard,
  listInvoices,
  generateInvoice,
  recordPayment,
  cancelInvoice,
  listUsageLogs,
  listMembers,
  listActiveCorporatesPublic,
  sendCorporateOtp,
  verifyCorporateOtp,
  getMyCorporateUsage,
  sendCorporateOwnerOtp,
  verifyCorporateOwnerOtp,
  getOwnerDashboard,
  getOwnerUsageLogs,
  getOwnerMembers,
} = require("../controllers/corporate");

/** Admin — billing & accounts */
router.get("/admin/billing/overview", isAdmin, getBillingOverview);
router.post("/admin/create", isAdmin, createCorporate);
router.get("/admin/getAll", isAdmin, listCorporatesAdmin);
router.get("/admin/get/:id", isAdmin, getCorporateAdmin);
router.get("/admin/:id/dashboard", isAdmin, getCorporateDashboard);
router.get("/admin/:id/invoices", isAdmin, listInvoices);
router.post("/admin/:id/invoices/generate", isAdmin, generateInvoice);
router.post("/admin/invoices/:invoiceId/payment", isAdmin, recordPayment);
router.delete("/admin/invoices/:invoiceId", isAdmin, cancelInvoice);
router.get("/admin/:id/usage", isAdmin, listUsageLogs);
router.get("/admin/:id/members", isAdmin, listMembers);
router.put("/admin/update/:id", isAdmin, updateCorporate);
router.delete("/admin/delete/:id", isAdmin, deleteCorporate);

/** Public auth */
router.get("/active", listActiveCorporatesPublic);
router.post("/send-otp", sendCorporateOtp);
router.put("/verify-otp", verifyCorporateOtp);
router.post("/owner/send-otp", sendCorporateOwnerOtp);
router.put("/owner/verify-otp", verifyCorporateOwnerOtp);

/** Corporate user */
router.get("/me/usage", verifyJwtToken, getMyCorporateUsage);

/** Corporate owner (company admin) */
router.get("/owner/dashboard", verifyJwtToken, requireCorporateOwner, getOwnerDashboard);
router.get("/owner/usage", verifyJwtToken, requireCorporateOwner, getOwnerUsageLogs);
router.get("/owner/members", verifyJwtToken, requireCorporateOwner, getOwnerMembers);

module.exports = { router, routePrefix: "/corporate" };
