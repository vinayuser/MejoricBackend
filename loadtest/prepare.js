/**
 * Create load-test caller + mate pairs in MongoDB and write JWT pairs to pairs.json.
 *
 * Usage (from Server/):
 *   npm run loadtest:prepare
 *   LOADTEST_PAIRS=100 npm run loadtest:prepare
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const mongoose = require("mongoose");
const config = require("./config");
const User = require("../models/User");
const Mate = require("../models/Mate");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const { ROLES, LOGIN_TYPES } = require("../constants");

async function main() {
  if (!config.mongoUrl) {
    console.error("MONGO_URL is missing in Server/.env");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB…`);
  await mongoose.connect(config.mongoUrl);

  const pairs = [];
  const password = config.defaultPassword;

  for (let i = 1; i <= config.pairCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    const callerEmail = `${config.emailPrefix}-caller-${suffix}@${config.emailDomain}`;
    const mateEmail = `${config.emailPrefix}-mate-${suffix}@${config.emailDomain}`;

    let caller = await User.findOne({ email: callerEmail, isDeleted: false });
    if (!caller) {
      caller = await User.create({
        name: `LoadTest Caller ${suffix}`,
        email: callerEmail,
        password,
        role: ROLES.USER,
        loginType: LOGIN_TYPES.EMAIL,
        isEmailVerified: true,
        isSignUpCompleted: true,
        isLoggedIn: false,
        age: 25,
        city: "LoadTest",
      });
    }

    let mateUser = await User.findOne({ email: mateEmail, isDeleted: false });
    if (!mateUser) {
      mateUser = await User.create({
        name: `LoadTest Mate ${suffix}`,
        email: mateEmail,
        password,
        role: ROLES.MATE,
        loginType: LOGIN_TYPES.EMAIL,
        isEmailVerified: true,
        isSignUpCompleted: true,
        isLoggedIn: false,
        age: 28,
        city: "LoadTest",
      });
    }

    let mate = await Mate.findOne({ userId: mateUser._id, isDeleted: false });
    if (!mate) {
      mate = await Mate.create({
        userId: mateUser._id,
        name: mateUser.name,
        email: mateUser.email,
        bio: "Load test mate",
        pricePerMin: 12,
        experience: 1,
        languages: ["English"],
        isAvailable: true,
        isBusy: false,
        isActive: true,
      });
    } else {
      mate.isAvailable = true;
      mate.isBusy = false;
      await mate.save();
    }

    let wallet = await Wallet.findOne({ userId: caller._id, isDeleted: false });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: caller._id,
        balances: { INR: config.walletBalance },
      });
      await WalletTransaction.create({
        walletId: wallet._id,
        userId: caller._id,
        type: "CREDIT",
        amount: config.walletBalance,
        currency: "INR",
        status: "SUCCESS",
        source: "MOCK_PAYMENT",
        description: "Load test wallet seed",
        openingBalance: 0,
        closingBalance: config.walletBalance,
      });
    } else {
      wallet.balances = wallet.balances || {};
      wallet.balances.INR = Math.max(wallet.balances.INR || 0, config.walletBalance);
      await wallet.save();
    }

    const callerToken = caller.getSignedJwtToken();
    const mateToken = mateUser.getSignedJwtToken();

    pairs.push({
      index: i,
      callerId: String(caller._id),
      mateUserId: String(mateUser._id),
      callerEmail,
      mateEmail,
      callerToken,
      mateToken,
    });

    if (i % 10 === 0 || i === config.pairCount) {
      console.log(`Prepared ${i}/${config.pairCount} pairs…`);
    }
  }

  const payload = {
    createdAt: new Date().toISOString(),
    pairCount: pairs.length,
    apiBaseUrl: config.apiBaseUrl,
    callType: config.callType,
    pairs,
  };

  fs.writeFileSync(config.pairsFile, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote ${pairs.length} pairs → ${config.pairsFile}`);
  console.log(`   Run: npm run loadtest:calls`);
  console.log(`   Example: LOADTEST_CONCURRENCY=50 LOADTEST_PAIRS=50 npm run loadtest:calls`);

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
