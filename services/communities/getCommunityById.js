const Community = require("../../models/Community");
const { throwError } = require("../../utils");

exports.getCommunityById = async (id) => {
  const community = await Community.findOne({ _id: id, isDeleted: false });
  if (!community) throwError(404, "Community not found");
  return community;
};
