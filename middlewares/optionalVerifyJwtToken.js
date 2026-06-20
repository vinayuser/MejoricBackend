const jwt = require("jsonwebtoken");
require("dotenv").config();
const { getUserById } = require("../services/users");
const { throwError, asyncWrapper } = require("../utils");

exports.optionalVerifyJwtToken = asyncWrapper(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token || token === "none") {
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    if (decodedToken?.id) {
      const user = await getUserById(decodedToken.id);
      if (user) {
        req.userId = user._id;
        req.role = user.role;
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid token for optional auth routes
  }

  next();
});
