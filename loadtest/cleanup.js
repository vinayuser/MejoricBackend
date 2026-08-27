/**
 * Remove load-test users created by prepare.js (email prefix + domain).
 *
 * Usage: npm run loadtest:cleanup
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const mongoose = require("mongoose");
const config = require("./config");
const User = require("../models/User");
const Mate = require("../models/Mate");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const CallSession = require("../models/CallSessions");

async function main() {
  await mongoose.connect(config.mongoUrl);

  const emailRegex = new RegExp(
    `^${config.emailPrefix}-(caller|mate)-[0-9]+@${config.emailDomain.replace(/\./g, "\\.")}$`,
    "i",
  );

  const users = await User.find({ email: emailRegex, isDeleted: false }).select(
    "_id email role",
  );
  const userIds = users.map((u) => u._id);

  if (!userIds.length) {
    console.log("No load-test users found.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${userIds.length} load-test users — soft-deleting…`);

  await CallSession.deleteMany({
    $or: [{ callerId: { $in: userIds } }, { receiverId: { $in: userIds } }],
  });
  await WalletTransaction.deleteMany({ userId: { $in: userIds } });
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await Mate.deleteMany({ userId: { $in: userIds } });
  await User.updateMany(
    { _id: { $in: userIds } },
    { $set: { isDeleted: true, isActive: false } },
  );

  if (fs.existsSync(config.pairsFile)) fs.unlinkSync(config.pairsFile);
  if (fs.existsSync(config.resultsFile)) fs.unlinkSync(config.resultsFile);

  console.log("✅ Load-test data cleaned up.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
