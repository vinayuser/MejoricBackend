const WalletTransaction = require("../../models/WalletTransaction");
const { pagination, throwError } = require("../../utils");

exports.getWalletHistory = async (userId, query) => {
  let {
    page,
    limit,
    currency,
    status,
    type,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;

  const match = { userId, isDeleted: false };
  if (currency) match.currency = currency;
  if (status) match.status = status;
  if (type) match.type = type;

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

  pipeline.push({
    $project: {
      type: 1,
      amount: 1,
      currency: 1,
      status: 1,
      source: 1,
      description: 1,
      openingBalance: 1,
      closingBalance: 1,
      reference: 1,
      metadata: 1,
      createdAt: 1,
    },
  });

  const sortStage = {};
  sortStage[sortBy] = sortOrder === "asc" ? 1 : -1;
  pipeline.push({ $sort: sortStage });

  try {
    return await pagination(WalletTransaction, pipeline, page, limit);
  } catch (err) {
    if (err && err.statusCode === 404)
      throwError(404, "No wallet history found");
    throw err;
  }
};
