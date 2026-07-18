const Community = require("../../models/Community");
const { throwError } = require("../../utils");

exports.deleteCommunityById = async (id) => {
  const community = await Community.findOne({ _id: id, isDeleted: false });
  if (!community) throwError(404, "Community not found");
  community.isDeleted = true;
  community.isActive = false;
  await community.save();
  return community;
};
