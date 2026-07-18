module.exports = {
  ...require("./createCommunity"),
  ...require("./getAllCommunitiesAdmin"),
  ...require("./getCommunityById"),
  ...require("./updateCommunityById"),
  ...require("./deleteCommunityById"),
  ...require("./listCommunities"),
  ...require("./membership"),
  ...require("./unlockWallet"),
  ...require("./unlockRazorpay"),
  ...require("./postsAndMessages"),
  ...require("./accessHelpers"),
};
