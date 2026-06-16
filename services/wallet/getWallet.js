const Wallet = require("../../models/Wallet");
const { throwError } = require("../../utils");

exports.getWallet = async (userId) => {
  const wallet = await Wallet.findOne({ userId, isDeleted: false }).lean();
  if (!wallet) throwError(404, "Wallet not found");
  return wallet;
};
