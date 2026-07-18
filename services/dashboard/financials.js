const WalletTransaction = require("../../models/WalletTransaction");
const CallSession = require("../../models/CallSessions");
const ChatSession = require("../../models/ChatSession");
const User = require("../../models/User");

const RECHARGE_SOURCES = ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"];
const SESSION_DEBIT_SOURCES = ["CALL", "CHAT"];
const PRODUCT_DEBIT_SOURCES = ["COMMUNITY", "THERAPY"];
const ALL_SPEND_SOURCES = [...SESSION_DEBIT_SOURCES, ...PRODUCT_DEBIT_SOURCES];

const mateSharePercent = () =>
  parseFloat(process.env.MATE_SHARE_PERCENTAGE) || 60;

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function sumAmount(match) {
  const rows = await WalletTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return {
    total: rows[0]?.total || 0,
    count: rows[0]?.count || 0,
  };
}

async function getOverview() {
  const base = { isDeleted: false, status: "SUCCESS" };

  const [
    recharges,
    sessionSpends,
    productSpends,
    matePayouts,
    welcomeCredits,
    bySource,
    statusCounts,
  ] = await Promise.all([
    sumAmount({
      ...base,
      type: "CREDIT",
      source: { $in: RECHARGE_SOURCES },
    }),
    sumAmount({
      ...base,
      type: "DEBIT",
      source: { $in: SESSION_DEBIT_SOURCES },
    }),
    sumAmount({
      ...base,
      type: "DEBIT",
      source: { $in: PRODUCT_DEBIT_SOURCES },
    }),
    sumAmount({
      ...base,
      type: "CREDIT",
      source: { $in: SESSION_DEBIT_SOURCES },
      "metadata.role": "receiver",
    }),
    sumAmount({
      isDeleted: false,
      status: "SUCCESS",
      type: "CREDIT",
      $or: [
        { "metadata.isWelcome": true },
        { description: /welcome/i },
      ],
    }),
    WalletTransaction.aggregate([
      { $match: base },
      {
        $group: {
          _id: { source: "$source", type: "$type" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
    WalletTransaction.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const totalRevenue = recharges.total;
  const totalUserSpends = sessionSpends.total + productSpends.total;
  const totalMatePayout = matePayouts.total;
  const netPlatformProfit = Math.max(0, totalRevenue - totalMatePayout);

  const sourceBreakdown = bySource.map((row) => ({
    source: row._id.source,
    type: row._id.type,
    total: row.total,
    count: row.count,
  }));

  const statusBreakdown = Object.fromEntries(
    statusCounts.map((s) => [
      s._id,
      { count: s.count, total: s.total },
    ]),
  );

  // 30-day timeline
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [timelineRecharges, timelineSpends, timelinePayouts] =
    await Promise.all([
      WalletTransaction.aggregate([
        {
          $match: {
            ...base,
            type: "CREDIT",
            source: { $in: RECHARGE_SOURCES },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            total: { $sum: "$amount" },
          },
        },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            ...base,
            type: "DEBIT",
            source: { $in: ALL_SPEND_SOURCES },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            total: { $sum: "$amount" },
          },
        },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            ...base,
            type: "CREDIT",
            source: { $in: SESSION_DEBIT_SOURCES },
            "metadata.role": "receiver",
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

  const timelineMap = {};
  const bump = (rows, key) => {
    for (const item of rows) {
      if (!timelineMap[item._id]) {
        timelineMap[item._id] = {
          date: item._id,
          recharges: 0,
          spends: 0,
          payouts: 0,
        };
      }
      timelineMap[item._id][key] = item.total;
    }
  };
  bump(timelineRecharges, "recharges");
  bump(timelineSpends, "spends");
  bump(timelinePayouts, "payouts");

  const timeline = Object.values(timelineMap).sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const txTotal = await WalletTransaction.countDocuments({ isDeleted: false });

  return {
    overview: {
      totalRevenue,
      totalUserSpends,
      sessionSpends: sessionSpends.total,
      productSpends: productSpends.total,
      totalMatePayout,
      netPlatformProfit,
      rechargeCount: recharges.count,
      sessionSpendCount: sessionSpends.count,
      productSpendCount: productSpends.count,
      matePayoutCount: matePayouts.count,
      welcomeCreditTotal: welcomeCredits.total,
      transactionTotal: txTotal,
      mateSharePercent: mateSharePercent(),
    },
    sourceBreakdown,
    statusBreakdown,
    timeline,
  };
}

async function getTransactions(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const match = { isDeleted: false };

  if (query.status && query.status !== "all") {
    match.status = String(query.status).toUpperCase();
  }
  if (query.type && query.type !== "all") {
    match.type = String(query.type).toUpperCase();
  }
  if (query.source && query.source !== "all") {
    match.source = String(query.source).toUpperCase();
  }
  if (query.userId) {
    match.userId = query.userId;
  }
  if (query.dateFrom || query.dateTo) {
    match.createdAt = {};
    if (query.dateFrom) match.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  let userIdsFromSearch = null;
  const search = String(query.search || "").trim();
  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    userIdsFromSearch = users.map((u) => u._id);
    match.$or = [
      { description: { $regex: search, $options: "i" } },
      { source: { $regex: search, $options: "i" } },
      ...(userIdsFromSearch.length
        ? [{ userId: { $in: userIdsFromSearch } }]
        : []),
      { "reference.razorpayPaymentId": { $regex: search, $options: "i" } },
      { "reference.razorpayOrderId": { $regex: search, $options: "i" } },
    ];
  }

  const [total, rows] = await Promise.all([
    WalletTransaction.countDocuments(match),
    WalletTransaction.find(match)
      .populate({ path: "userId", select: "name email mobile role" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const data = rows.map((tx) => ({
    id: String(tx._id),
    _id: tx._id,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency || "INR",
    status: tx.status,
    source: tx.source,
    description: tx.description || "",
    openingBalance: tx.openingBalance ?? null,
    closingBalance: tx.closingBalance ?? null,
    reference: tx.reference || {},
    metadata: tx.metadata || {},
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    user: tx.userId
      ? {
          id: String(tx.userId._id),
          _id: tx.userId._id,
          name: tx.userId.name,
          email: tx.userId.email,
          mobile: tx.userId.mobile,
          role: tx.userId.role,
        }
      : null,
    // keep legacy shape for older UI bits
    userId: tx.userId,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getUsers(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = String(query.search || "").trim();

  const pipeline = [
    { $match: { isDeleted: false, status: "SUCCESS" } },
    {
      $group: {
        _id: "$userId",
        totalRecharged: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "CREDIT"] },
                  { $in: ["$source", RECHARGE_SOURCES] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        rechargeCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "CREDIT"] },
                  { $in: ["$source", RECHARGE_SOURCES] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalSpent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEBIT"] },
                  { $in: ["$source", ALL_SPEND_SOURCES] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        spendCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEBIT"] },
                  { $in: ["$source", ALL_SPEND_SOURCES] },
                ],
              },
              1,
              0,
            ],
          },
        },
        sessionSpent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEBIT"] },
                  { $in: ["$source", SESSION_DEBIT_SOURCES] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        productSpent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEBIT"] },
                  { $in: ["$source", PRODUCT_DEBIT_SOURCES] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        lastTxnAt: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "wallets",
        localField: "_id",
        foreignField: "userId",
        as: "wallet",
      },
    },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "user.name": { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
          { "user.mobile": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $project: {
        _id: 1,
        totalRecharged: 1,
        rechargeCount: 1,
        totalSpent: 1,
        spendCount: 1,
        sessionSpent: 1,
        productSpent: 1,
        lastTxnAt: 1,
        userName: "$user.name",
        userEmail: "$user.email",
        userMobile: "$user.mobile",
        userRole: "$user.role",
        walletBalance: {
          $ifNull: [{ $arrayElemAt: ["$wallet.balances.INR", 0] }, 0],
        },
      },
    },
    { $sort: { lastTxnAt: -1 } },
  );

  const countPipeline = [...pipeline, { $count: "total" }];
  const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

  const [countRows, data] = await Promise.all([
    WalletTransaction.aggregate(countPipeline),
    WalletTransaction.aggregate(dataPipeline),
  ]);

  const total = countRows[0]?.total || 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getSessions(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = String(query.search || "").trim();
  const sharePct = mateSharePercent();

  const rechargedUsers = await WalletTransaction.distinct("userId", {
    isDeleted: false,
    status: "SUCCESS",
    type: "CREDIT",
    source: { $in: RECHARGE_SOURCES },
  });
  const rechargedUsersSet = new Set(rechargedUsers.map((id) => String(id)));

  const callMatch = { callStatus: "ENDED" };
  const chatMatch = { status: "ENDED" };

  // Load a window large enough for search+sort then paginate in memory for correctness
  // Cap at 2000 combined for admin tool performance
  const [calls, chats] = await Promise.all([
    CallSession.find(callMatch)
      .populate({ path: "callerId", select: "name email mobile" })
      .populate({ path: "receiverId", select: "name email mobile" })
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean(),
    ChatSession.find(chatMatch)
      .populate({ path: "senderId", select: "name email mobile" })
      .populate({ path: "recipientId", select: "name email mobile" })
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean(),
  ]);

  const mapCall = (session) => {
    const callerIdStr = String(
      session.callerId?._id || session.callerId || "",
    );
    const isFreeSession = !rechargedUsersSet.has(callerIdStr);
    const totalAmountDeducted = session.totalAmountDeducted || 0;
    const mateShare = isFreeSession
      ? 0
      : Number(((totalAmountDeducted * sharePct) / 100).toFixed(2));
    const platformShare = isFreeSession
      ? 0
      : Number(
          ((totalAmountDeducted * (100 - sharePct)) / 100).toFixed(2),
        );
    return {
      id: String(session._id),
      sessionKind: "CALL",
      mateName: session.receiverId?.name || session.receiverName || "Mate",
      mateEmail: session.receiverId?.email || session.receiverEmail || "",
      mateMobile: session.receiverId?.mobile || "",
      callerName: session.callerId?.name || session.callerName || "User",
      callerEmail: session.callerId?.email || session.callerEmail || "",
      callerMobile: session.callerId?.mobile || "",
      callType: session.callType || "AUDIO",
      duration: session.duration || 0,
      ratePerMin: session.callChargePerMin || null,
      totalAmountDeducted,
      mateShare,
      platformShare,
      isFreeSession,
      createdAt: session.createdAt || session.startTime,
      startTime: session.startTime,
      endTime: session.endTime,
    };
  };

  const mapChat = (session) => {
    const senderIdStr = String(
      session.senderId?._id || session.senderId || "",
    );
    const isFreeSession = !rechargedUsersSet.has(senderIdStr);
    const totalAmountDeducted = session.totalAmountDeducted || 0;
    const mateShare = isFreeSession
      ? 0
      : Number(((totalAmountDeducted * sharePct) / 100).toFixed(2));
    const platformShare = isFreeSession
      ? 0
      : Number(
          ((totalAmountDeducted * (100 - sharePct)) / 100).toFixed(2),
        );
    return {
      id: String(session._id),
      sessionKind: "CHAT",
      mateName: session.recipientId?.name || "Mate",
      mateEmail: session.recipientId?.email || "",
      mateMobile: session.recipientId?.mobile || "",
      callerName: session.senderId?.name || "User",
      callerEmail: session.senderId?.email || "",
      callerMobile: session.senderId?.mobile || "",
      callType: "CHAT",
      duration: session.duration || 0,
      ratePerMin: session.chatChargePerMin || null,
      totalAmountDeducted,
      mateShare,
      platformShare,
      isFreeSession,
      createdAt: session.createdAt || session.startTime,
      startTime: session.startTime,
      endTime: session.endTime,
    };
  };

  let rows = [...calls.map(mapCall), ...chats.map(mapChat)].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.mateName?.toLowerCase().includes(q) ||
        r.callerName?.toLowerCase().includes(q) ||
        r.mateEmail?.toLowerCase().includes(q) ||
        r.callerEmail?.toLowerCase().includes(q) ||
        r.callType?.toLowerCase().includes(q) ||
        r.sessionKind?.toLowerCase().includes(q),
    );
  }

  const total = rows.length;
  const data = rows.slice(skip, skip + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    mateSharePercent: sharePct,
  };
}

module.exports = {
  getOverview,
  getTransactions,
  getUsers,
  getSessions,
};
