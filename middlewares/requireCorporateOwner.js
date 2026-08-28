const { throwError, asyncWrapper } = require("../utils");
const { CORPORATE_ROLES } = require("../constants");

exports.requireCorporateOwner = asyncWrapper(async (req, res, next) => {
  const user = req.user;
  if (!user) throwError(401, "Authentication required");
  if (
    !user.corporateId ||
    user.corporateRole !== CORPORATE_ROLES.OWNER
  ) {
    throwError(403, "Corporate owner access required");
  }
  req.corporateId = user.corporateId;
  next();
});
