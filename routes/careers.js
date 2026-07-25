const express = require("express");
const router = express.Router();
const { isAdmin } = require("../middlewares");
const {
  createJob,
  updateJob,
  deleteJob,
  getJobAdmin,
  listJobsAdmin,
  listJobsPublic,
  getJobPublic,
  applyToJob,
  listApplicationsAdmin,
  updateApplicationStatus,
} = require("../controllers/careers");

/** Admin */
router.post("/create", isAdmin, createJob);
router.get("/admin/getAll", isAdmin, listJobsAdmin);
router.get("/admin/get/:id", isAdmin, getJobAdmin);
router.put("/update/:id", isAdmin, updateJob);
router.delete("/delete/:id", isAdmin, deleteJob);
router.get("/admin/applications", isAdmin, listApplicationsAdmin);
router.put("/admin/applications/:id/status", isAdmin, updateApplicationStatus);

/** Public */
router.get("/list", listJobsPublic);
router.get("/get/:id", getJobPublic);
router.post("/:id/apply", applyToJob);

module.exports = { router, routePrefix: "/careers" };
