const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { updateUserById } = require("../../services/users");
const { validateUpdateUser } = require("../../validator/users");
const { ROLES } = require("../../constants");

exports.updateUser = asyncWrapper(async (req, res) => {
  const userId = req.query?.userId || req.userId;
  console.log("DEBUG: updateUser controller reached for userId:", userId);
  if (!userId || userId === "undefined") {
    console.log("DEBUG: userId is missing or undefined string");
    throwError(422, "User ID is required");
  }
  validateObjectId(userId, "User ID");
  if (String(userId) !== String(req.userId) && req.role !== ROLES.ADMIN) {
    throwError(403, "You can only update your own profile or need admin access");
  }

  // Normalize array fields that might be sent as strings via FormData
  ["specifications", "languages"].forEach((field) => {
    if (req.body && req.body[field]) {
      if (typeof req.body[field] === "string") {
        try {
          const parsed = JSON.parse(req.body[field]);
          req.body[field] = Array.isArray(parsed) ? parsed : [req.body[field]];
        } catch (e) {
          // If not JSON, it's likely a single value or comma-separated string
          req.body[field] = req.body[field]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else if (!Array.isArray(req.body[field])) {
        req.body[field] = [req.body[field]];
      }
    }
  });

  const { error } = validateUpdateUser(req.body);
  if (error) throwError(422, error.details.map((d) => d.message).join(", "));
  const image = req.files?.image;
  const updatedUser = await updateUserById(userId, req.body, image);
  return sendSuccess(
    res,
    200,
    "User profile updated successfully",
    updatedUser
  );
});
