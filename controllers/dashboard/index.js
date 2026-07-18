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

// @desc    Get financial overview (KPIs + timeline)
// @route   GET /dashboard/financials
// @access  Private (Admin)
const getFinancials = async (req, res) => {
  try {
    const {
      getOverview,
    } = require("../../services/dashboard/financials");
    const data = await getOverview();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Financials API error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching financial statistics",
    });
  }
};

// @desc    Paginated wallet transactions
// @route   GET /dashboard/financials/transactions
const getFinancialTransactions = async (req, res) => {
  try {
    const { getTransactions } = require("../../services/dashboard/financials");
    const data = await getTransactions(req.query);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("Financial transactions API error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
    });
  }
};

// @desc    Paginated user recharge/spend summary
// @route   GET /dashboard/financials/users
const getFinancialUsers = async (req, res) => {
  try {
    const { getUsers } = require("../../services/dashboard/financials");
    const data = await getUsers(req.query);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("Financial users API error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user financials",
    });
  }
};

// @desc    Paginated mate call/chat payout sessions
// @route   GET /dashboard/financials/sessions
const getFinancialSessions = async (req, res) => {
  try {
    const { getSessions } = require("../../services/dashboard/financials");
    const data = await getSessions(req.query);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("Financial sessions API error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching session payouts",
    });
  }
};

module.exports = {
  getDashboard,
  getFinancials,
  getFinancialTransactions,
  getFinancialUsers,
  getFinancialSessions,
};
