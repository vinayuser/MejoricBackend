const Contact = require("../../models/Contact");
const { pagination } = require("../../utils");

exports.getAllContacts = async (query) => {
  let {
    page,
    limit,
    search,
    name,
    email,
    mobile,
    subject,
    message,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;
  const match = { isDeleted: false };
  if (name) match.name = { $regex: new RegExp(name, "i") };
  if (email) match.email = { $regex: new RegExp(email, "i") };
  if (mobile) match.mobile = { $regex: new RegExp(mobile, "i") };
  if (subject) match.subject = { $regex: new RegExp(subject, "i") };
  if (message) match.message = { $regex: new RegExp(message, "i") };
  if (search) {
    match.$or = [
      { name: { $regex: new RegExp(search, "i") } },
      { email: { $regex: new RegExp(search, "i") } },
      { mobile: { $regex: new RegExp(search, "i") } },
      { subject: { $regex: new RegExp(search, "i") } },
      { message: { $regex: new RegExp(search, "i") } },
    ];
  }
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      match.createdAt.$lte = d;
    }
  }
  const pipeline = [{ $match: match }];
  const sortStage = {};
  sortStage[sortBy] = sortOrder === "asc" ? 1 : -1;
  pipeline.push({ $sort: sortStage });
  return await pagination(Contact, pipeline, page, limit);
};
