const User = require("../../models/User");
const Category = require("../../models/Category");
const Product = require("../../models/Product");
const SubCategory = require("../../models/SubCategory");
const Subscription = require("../../models/Subscription");
const Banner = require("../../models/Banner");
const { ROLES } = require("../../constants");

// @desc    Get dashboard data
// @route   GET /dashboard
// @access  Private (Admin)
const getDashboard = async (req, res) => {
  try {
    // Get total counts
    const [
      totalUsers,
      totalCategories,
      totalProducts,
      totalSubCategories,
      totalSubscriptions,
      totalBanners,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Category.countDocuments({ isDeleted: false }),
      Product.countDocuments({ isDeleted: false }),
      SubCategory.countDocuments({ isDeleted: false }),
      Subscription.countDocuments(),
      Banner.countDocuments({ isDeleted: false }),
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await User.countDocuments({
      isDeleted: false,
      createdAt: { $gte: sevenDaysAgo },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayRegisteredUsersMatch = {
      isDeleted: false,
      role: ROLES.USER,
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    };

    const [todayRegisteredUsersCount, todayRegisteredUsers] = await Promise.all([
      User.countDocuments(todayRegisteredUsersMatch),
      User.find(todayRegisteredUsersMatch)
        .select("name email mobile age city createdAt isMobileVerified isActive")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    // Get users by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const usersByMonth = await User.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get products by category
    const productsByCategory = await Product.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category.name",
          count: { $sum: 1 },
        },
      },
    ]);

    // Mock data for charts (since we don't have actual appointments/sales)
    const statusCounts = [
      { _id: "active", count: Math.floor(totalUsers * 0.6) },
      { _id: "pending", count: Math.floor(totalUsers * 0.3) },
      { _id: "inactive", count: Math.floor(totalUsers * 0.1) },
    ];

    const testCountsByStatus = [
      { _id: "completed", count: Math.floor(totalProducts * 0.5) },
      { _id: "pending", count: Math.floor(totalProducts * 0.3) },
      { _id: "cancelled", count: Math.floor(totalProducts * 0.2) },
    ];

    const selles = [
      {
        title: "Jan",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
      {
        title: "Feb",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
      {
        title: "Mar",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
      {
        title: "Apr",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
      {
        title: "May",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
      {
        title: "Jun",
        totalRevenue: Math.floor(Math.random() * 50000) + 10000,
        totalQuantitySold: Math.floor(Math.random() * 100) + 20,
      },
    ];

    const today = {
      totalTests: Math.floor(totalProducts * 0.1),
      totalRevenue: Math.floor(Math.random() * 10000) + 1000,
    };

    const todaysAppointments = Array(Math.floor(Math.random() * 10) + 1)
      .fill(null)
      .map((_, i) => ({
        _id: `apt-${i}`,
        name: `Appointment ${i + 1}`,
      }));

    res.status(200).json({
      success: true,
      data: {
        // Summary stats
        totalUsers,
        totalCategories,
        totalProducts,
        totalSubCategories,
        totalSubscriptions,
        totalBanners,
        recentUsers,
        todayRegisteredUsersCount,
        todayRegisteredUsers,

        // Chart data
        statusCounts,
        testCountsByStatus,
        selles,
        usersByRole,
        usersByMonth,
        productsByCategory,

        // Today's data
        today,
        todaysAppointments,
        todaySells: Math.floor(Math.random() * 50) + 10,
        todayRevenue: Math.floor(Math.random() * 5000) + 500,
        totalSells: Math.floor(Math.random() * 500) + 100,
        totalRevenue: Math.floor(Math.random() * 100000) + 20000,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard data",
    });
  }
};

// @desc    Get detailed financial statistics
// @route   GET /dashboard/financials
// @access  Private (Admin)
const getFinancials = async (req, res) => {
  try {
    const WalletTransaction = require("../../models/WalletTransaction");
    const CallSession = require("../../models/CallSessions");
    const ChatSession = require("../../models/ChatSession");
    const Wallet = require("../../models/Wallet");
    const User = require("../../models/User");

    // 1. Recharges and Spending Aggregation per User
    const rechargeSpending = await WalletTransaction.aggregate([
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
                    { $in: ["$source", ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"]] }
                  ]
                },
                "$amount",
                0
              ]
            }
          },
          totalSpent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "DEBIT"] },
                    { $in: ["$source", ["CALL", "CHAT"]] }
                  ]
                },
                "$amount",
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "userId",
          as: "wallet"
        }
      },
      {
        $project: {
          _id: 1,
          totalRecharged: 1,
          totalSpent: 1,
          userName: "$user.name",
          userEmail: "$user.email",
          userPhone: "$user.phone",
          userRole: "$user.role",
          walletBalance: {
            $ifNull: [
              { $arrayElemAt: ["$wallet.balances.INR", 0] },
              0
            ]
          }
        }
      },
      { $sort: { totalRecharged: -1 } }
    ]);

    // 2. Fetch recent transactions for recharges & spending details
    const recentTx = await WalletTransaction.find({
      isDeleted: false,
      status: "SUCCESS"
    })
      .populate({ path: "userId", select: "name email role" })
      .sort({ createdAt: -1 })
      .limit(200);

    // 3. Mate Call & Chat Payouts (grouped daily)
    const callSessions = await CallSession.find({ callStatus: "ENDED" })
      .populate({ path: "callerId", select: "name email" })
      .populate({ path: "receiverId", select: "name email" })
      .sort({ createdAt: -1 });

    const chatSessions = await ChatSession.find({ status: "ENDED" })
      .populate({ path: "senderId", select: "name email" })
      .populate({ path: "recipientId", select: "name email" })
      .sort({ createdAt: -1 });

    // Fetch all users who have successfully recharged to distinguish free welcome credits
    const rechargedUsers = await WalletTransaction.distinct("userId", {
      isDeleted: false,
      status: "SUCCESS",
      type: "CREDIT",
      source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] }
    });
    const rechargedUsersSet = new Set(rechargedUsers.map((id) => id.toString()));

    const dailyEarningsMap = {};
    const mateSharePercent = parseFloat(process.env.MATE_SHARE_PERCENTAGE) || 60;

    // Process Calls
    for (const session of callSessions) {
      const dateStr = new Date(session.createdAt || session.startTime).toLocaleDateString("en-GB"); // Format: DD/MM/YYYY
      if (!dailyEarningsMap[dateStr]) {
        dailyEarningsMap[dateStr] = {
          date: dateStr,
          totalMateEarnings: 0,
          totalPlatformEarnings: 0,
          calls: []
        };
      }

      const callerIdStr = session.callerId?._id?.toString() || session.callerId?.toString();
      const isFreeSession = !rechargedUsersSet.has(callerIdStr);

      const callerName = session.callerId?.name || "User";
      const mateName = session.receiverId?.name || "Mate";
      const totalAmountDeducted = session.totalAmountDeducted || 0;

      const mateShare = isFreeSession ? 0 : Number((totalAmountDeducted * (mateSharePercent / 100)).toFixed(2));
      const platformShare = isFreeSession ? 0 : Number((totalAmountDeducted * ((100 - mateSharePercent) / 100)).toFixed(2));

      dailyEarningsMap[dateStr].totalMateEarnings += mateShare;
      dailyEarningsMap[dateStr].totalPlatformEarnings += platformShare;
      dailyEarningsMap[dateStr].calls.push({
        transactionId: session._id,
        mateName,
        callerName,
        callType: session.callType || "AUDIO",
        duration: session.duration || 0,
        totalAmountDeducted,
        mateShare,
        platformShare,
        isFreeSession,
        createdAt: session.createdAt || session.startTime
      });
    }

    // Process Chats
    for (const session of chatSessions) {
      const dateStr = new Date(session.createdAt || session.startTime).toLocaleDateString("en-GB"); // Format: DD/MM/YYYY
      if (!dailyEarningsMap[dateStr]) {
        dailyEarningsMap[dateStr] = {
          date: dateStr,
          totalMateEarnings: 0,
          totalPlatformEarnings: 0,
          calls: []
        };
      }

      const senderIdStr = session.senderId?._id?.toString() || session.senderId?.toString();
      const isFreeSession = !rechargedUsersSet.has(senderIdStr);

      const callerName = session.senderId?.name || "User";
      const mateName = session.recipientId?.name || "Mate";
      const totalAmountDeducted = session.totalAmountDeducted || 0;

      const mateShare = isFreeSession ? 0 : Number((totalAmountDeducted * (mateSharePercent / 100)).toFixed(2));
      const platformShare = isFreeSession ? 0 : Number((totalAmountDeducted * ((100 - mateSharePercent) / 100)).toFixed(2));

      dailyEarningsMap[dateStr].totalMateEarnings += mateShare;
      dailyEarningsMap[dateStr].totalPlatformEarnings += platformShare;
      dailyEarningsMap[dateStr].calls.push({
        transactionId: session._id,
        mateName,
        callerName,
        callType: "CHAT",
        duration: session.duration || 0,
        totalAmountDeducted,
        mateShare,
        platformShare,
        isFreeSession,
        createdAt: session.createdAt || session.startTime
      });
    }

    for (const dateStr in dailyEarningsMap) {
      dailyEarningsMap[dateStr].calls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      dailyEarningsMap[dateStr].totalMateEarnings = Number(dailyEarningsMap[dateStr].totalMateEarnings.toFixed(2));
      dailyEarningsMap[dateStr].totalPlatformEarnings = Number(dailyEarningsMap[dateStr].totalPlatformEarnings.toFixed(2));
    }

    const dailyEarnings = Object.values(dailyEarningsMap).sort((a, b) => {
      // Sort daily earnings descending by date
      const [dayA, monthA, yearA] = a.date.split("/");
      const [dayB, monthB, yearB] = b.date.split("/");
      return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
    });

    // 4. Overall Platform Financial Overview
    // Capital added via Recharges
    const totalRechargeCredits = await WalletTransaction.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "SUCCESS",
          type: "CREDIT",
          source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    const totalRevenue = totalRechargeCredits[0]?.total || 0;

    // Total spent in sessions (Call + Chat) debited from users
    const totalSessionSpends = await WalletTransaction.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "SUCCESS",
          type: "DEBIT",
          source: { $in: ["CALL", "CHAT"] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    const totalUserSpends = totalSessionSpends[0]?.total || 0;

    // Total distributed to Mates (Credit from Call + Chat)
    const totalMateCredits = await WalletTransaction.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "SUCCESS",
          type: "CREDIT",
          source: { $in: ["CALL", "CHAT"] },
          "metadata.role": "receiver"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    const totalMatePayout = totalMateCredits[0]?.total || 0;

    // Net platform profit (Real Recharges - distributed payout)
    const netPlatformProfit = Math.max(0, totalRevenue - totalMatePayout);

    // 5. 30-Day Daily Chart Timeline (Combines Recharges & distributed Payouts)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timelineRecharges = await WalletTransaction.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "SUCCESS",
          type: "CREDIT",
          source: { $in: ["RAZORPAY", "ADMIN", "MOCK_PAYMENT"] },
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const timelinePayouts = await WalletTransaction.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "SUCCESS",
          type: "CREDIT",
          source: { $in: ["CALL", "CHAT"] },
          "metadata.role": "receiver",
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // Merge timeline maps
    const timelineMap = {};
    for (const item of timelineRecharges) {
      timelineMap[item._id] = { date: item._id, recharges: item.total, payouts: 0 };
    }
    for (const item of timelinePayouts) {
      if (!timelineMap[item._id]) {
        timelineMap[item._id] = { date: item._id, recharges: 0, payouts: item.total };
      } else {
        timelineMap[item._id].payouts = item.total;
      }
    }

    const timeline = Object.values(timelineMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: {
        rechargeSpending,
        dailyEarnings,
        overview: {
          totalRevenue,
          totalUserSpends,
          totalMatePayout,
          netPlatformProfit
        },
        recentTransactions: recentTx,
        timeline
      }
    });
  } catch (error) {
    console.error("Financials API error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching financial statistics"
    });
  }
};

module.exports = { getDashboard, getFinancials };
