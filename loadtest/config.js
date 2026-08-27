require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");

module.exports = {
  mongoUrl: process.env.MONGO_URL,
  jwtSecret: process.env.JWT_SECRET,
  defaultPassword: process.env.DEFAULT_PASSWORD || "MateAndMentors@123",
  apiBaseUrl:
    process.env.LOADTEST_API_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:3002/mateandmentors",
  socketUrl:
    process.env.LOADTEST_SOCKET_URL ||
    process.env.SOCKET_SERVER_URL ||
    "http://localhost:3002",
  pairCount: Math.max(1, parseInt(process.env.LOADTEST_PAIRS || "100", 10)),
  concurrency: Math.max(1, parseInt(process.env.LOADTEST_CONCURRENCY || "100", 10)),
  callType: (process.env.LOADTEST_CALL_TYPE || "AUDIO").toUpperCase(),
  holdMs: Math.max(0, parseInt(process.env.LOADTEST_HOLD_MS || "3000", 10)),
  deferRing: process.env.LOADTEST_DEFER_RING !== "false",
  emailPrefix: process.env.LOADTEST_EMAIL_PREFIX || "loadtest",
  emailDomain: process.env.LOADTEST_EMAIL_DOMAIN || "loadtest.mejoric.local",
  walletBalance: Math.max(500, parseInt(process.env.LOADTEST_WALLET_INR || "5000", 10)),
  pairsFile: path.join(__dirname, "pairs.json"),
  resultsFile: path.join(__dirname, "results.json"),
};
