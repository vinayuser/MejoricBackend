const CareerJob = require("../../models/CareerJob");
const CareerApplication = require("../../models/CareerApplication");
const { throwError } = require("../../utils");
const { uploadPDF } = require("../uploads");

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function parseSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof skills === "string") {
    try {
      const parsed = JSON.parse(skills);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      /* comma-separated */
    }
    return skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBool(v, fallback = false) {
  if (v === undefined || v === null || v === "") return fallback;
  return v === true || v === "true" || v === "1" || v === 1;
}

function formatJob(job, { applicationCount } = {}) {
  if (!job) return null;
  const o = job.toObject ? job.toObject() : job;
  return {
    id: String(o._id),
    _id: o._id,
    title: o.title,
    slug: o.slug,
    description: o.description || "",
    skills: o.skills || [],
    location: o.location || "",
    isRemote: Boolean(o.isRemote),
    employmentType: o.employmentType || "full-time",
    experience: o.experience || "",
    department: o.department || "",
    salaryRange: o.salaryRange || "",
    isActive: o.isActive !== false,
    applicationCount: applicationCount ?? o.applicationCount ?? 0,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function formatApplication(app, job) {
  const o = app.toObject ? app.toObject() : app;
  return {
    id: String(o._id),
    _id: o._id,
    jobId: String(o.jobId?._id || o.jobId),
    jobTitle: job?.title || o.jobId?.title || "",
    name: o.name,
    email: o.email,
    mobile: o.mobile || "",
    cvUrl: o.cvUrl,
    cvFileName: o.cvFileName || "",
    whyApplying: o.whyApplying,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

exports.createJob = async (body = {}) => {
  const title = String(body.title || "").trim();
  if (!title) throwError(422, "Job title is required");

  const job = await CareerJob.create({
    title,
    slug: slugify(title),
    description: String(body.description || ""),
    skills: parseSkills(body.skills),
    location: String(body.location || "").trim(),
    isRemote: parseBool(body.isRemote, true),
    employmentType: body.employmentType || "full-time",
    experience: String(body.experience || "").trim(),
    department: String(body.department || "").trim(),
    salaryRange: String(body.salaryRange || "").trim(),
    isActive: parseBool(body.isActive, true),
  });

  return formatJob(job);
};

exports.updateJob = async (id, body = {}) => {
  const job = await CareerJob.findOne({ _id: id, isDeleted: false });
  if (!job) throwError(404, "Job not found");

  if (body.title != null) {
    job.title = String(body.title).trim();
    if (!job.title) throwError(422, "Job title is required");
    job.slug = slugify(job.title);
  }
  if (body.description != null) job.description = String(body.description);
  if (body.skills != null) job.skills = parseSkills(body.skills);
  if (body.location != null) job.location = String(body.location).trim();
  if (body.isRemote != null) job.isRemote = parseBool(body.isRemote);
  if (body.employmentType != null) job.employmentType = body.employmentType;
  if (body.experience != null) job.experience = String(body.experience).trim();
  if (body.department != null) job.department = String(body.department).trim();
  if (body.salaryRange != null) job.salaryRange = String(body.salaryRange).trim();
  if (body.isActive != null) job.isActive = parseBool(body.isActive);

  await job.save();
  return formatJob(job);
};

exports.deleteJob = async (id) => {
  const job = await CareerJob.findOne({ _id: id, isDeleted: false });
  if (!job) throwError(404, "Job not found");
  job.isDeleted = true;
  job.isActive = false;
  await job.save();
  return { id: String(job._id) };
};

exports.getJobAdmin = async (id) => {
  const job = await CareerJob.findOne({ _id: id, isDeleted: false }).lean();
  if (!job) throwError(404, "Job not found");
  const applicationCount = await CareerApplication.countDocuments({
    jobId: id,
    isDeleted: false,
  });
  return formatJob(job, { applicationCount });
};

exports.listJobsAdmin = async ({ page = 1, limit = 20, search } = {}) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (page - 1) * limit;

  const match = { isDeleted: false };
  if (search) {
    match.$or = [
      { title: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const [total, jobs] = await Promise.all([
    CareerJob.countDocuments(match),
    CareerJob.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const ids = jobs.map((j) => j._id);
  const counts = await CareerApplication.aggregate([
    { $match: { jobId: { $in: ids }, isDeleted: false } },
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(
    counts.map((c) => [String(c._id), c.count]),
  );

  return {
    data: jobs.map((j) =>
      formatJob(j, { applicationCount: countMap[String(j._id)] || 0 }),
    ),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

exports.listJobsPublic = async ({ page = 1, limit = 20, search, remote } = {}) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (page - 1) * limit;

  const match = { isDeleted: false, isActive: true };
  if (remote === "true" || remote === true) match.isRemote = true;
  if (search) {
    match.$or = [
      { title: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { skills: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  const [total, jobs] = await Promise.all([
    CareerJob.countDocuments(match),
    CareerJob.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-isDeleted")
      .lean(),
  ]);

  return {
    data: jobs.map((j) => formatJob(j)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

exports.getJobPublic = async (id) => {
  const job = await CareerJob.findOne({
    _id: id,
    isDeleted: false,
    isActive: true,
  }).lean();
  if (!job) throwError(404, "Job not found");
  return formatJob(job);
};

exports.applyToJob = async (jobId, body = {}, cvFile) => {
  const job = await CareerJob.findOne({
    _id: jobId,
    isDeleted: false,
    isActive: true,
  });
  if (!job) throwError(404, "Job not found or no longer accepting applications");

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const mobile = String(body.mobile || "").trim();
  const whyApplying = String(body.whyApplying || "").trim();

  if (!name) throwError(422, "Name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throwError(422, "Valid email is required");
  }
  if (!whyApplying) throwError(422, "Please tell us why you are applying");
  if (whyApplying.length > 5000) throwError(422, "Application note is too long");
  if (!cvFile) throwError(422, "CV / resume is required");

  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const mime = cvFile.mimetype || "";
  const originalName = cvFile.name || "cv.pdf";
  if (
    !allowed.includes(mime) &&
    !/\.(pdf|doc|docx)$/i.test(originalName)
  ) {
    throwError(422, "CV must be a PDF or Word document");
  }

  const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const cvUrl = await uploadPDF(cvFile.tempFilePath, safeName);

  const existing = await CareerApplication.findOne({
    jobId,
    email,
    isDeleted: false,
  });
  if (existing) {
    throwError(409, "You have already applied for this role with this email");
  }

  const app = await CareerApplication.create({
    jobId,
    name,
    email,
    mobile,
    cvUrl,
    cvFileName: originalName,
    whyApplying,
  });

  return formatApplication(app, job);
};

exports.listApplicationsAdmin = async ({
  page = 1,
  limit = 20,
  jobId,
  status,
  search,
} = {}) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (page - 1) * limit;

  const match = { isDeleted: false };
  if (jobId) match.jobId = jobId;
  if (status && status !== "all") match.status = status;
  if (search) {
    match.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }

  const [total, rows] = await Promise.all([
    CareerApplication.countDocuments(match),
    CareerApplication.find(match)
      .populate({ path: "jobId", select: "title" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    data: rows.map((r) => formatApplication(r, r.jobId)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

exports.updateApplicationStatus = async (id, status) => {
  const allowed = ["pending", "reviewed", "shortlisted", "rejected"];
  if (!allowed.includes(status)) throwError(422, "Invalid status");
  const app = await CareerApplication.findOne({ _id: id, isDeleted: false });
  if (!app) throwError(404, "Application not found");
  app.status = status;
  await app.save();
  return formatApplication(app);
};
