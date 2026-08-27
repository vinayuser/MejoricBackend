const express = require("express");
const router = express.Router();
const { isAdmin, verifyJwtToken } = require("../middlewares");
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

/** Corporate user */
router.get("/me/usage", verifyJwtToken, getMyCorporateUsage);

module.exports = { router, routePrefix: "/corporate" };
