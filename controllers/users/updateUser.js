const { asyncWrapper, sendSuccess, throwError, validateObjectId } = require("../../utils");
const { updateUserById } = require("../../services/users");
const { validateUpdateUser } = require("../../validator/users");
const { ROLES } = require("../../constants");

// Helper functions
const normalizeArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return value.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return [value];
};

const coerceNumberField = (value) => {
  if (value === undefined || value === "" || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const coerceBooleanField = (value) => {
  if (value === undefined || value === null) return undefined;
  const truthy = [true, "true", 1, "1"];
  const falsy = [false, "false", 0, "0"];
  if (truthy.includes(value)) return true;
  if (falsy.includes(value)) return false;
  return undefined;
};

const processFormDataFields = (body) => {
  const result = { ...body };
  
  // Array fields
  const arrayFields = ["specifications", "languages", "domainIds", "domains"];
  arrayFields.forEach(field => {
    if (result[field] !== undefined) {
      result[field] = normalizeArrayField(result[field]);
    }
  });
  
  // Number fields
  const numberFields = [
    "audioCallPrice", "videoCallPrice", "video60CallPrice",
    "pricePerMin", "pricePerHour", "experience"
  ];
  numberFields.forEach(field => {
    if (result[field] !== undefined && result[field] !== "") {
      const coerced = coerceNumberField(result[field]);
      if (coerced !== undefined) result[field] = coerced;
    }
  });
  
  // Boolean fields
  const booleanFields = ["isActive", "isAvailable", "isOnline"];
  booleanFields.forEach(field => {
    if (result[field] !== undefined) {
      const coerced = coerceBooleanField(result[field]);
      if (coerced !== undefined) result[field] = coerced;
    }
  });
  
  return result;
};

exports.updateUser = asyncWrapper(async (req, res) => {
  // Prefer route :id (admin mentor/mate update). Express 5 ignores req.query reassignment.
  const userId =
    req.targetUserId ||
    req.params?.id ||
    req.query?.userId ||
    req.userId;
  console.log("DEBUG: updateUser target userId:", String(userId), {
    targetUserId: req.targetUserId,
    paramsId: req.params?.id,
    queryUserId: req.query?.userId,
    jwtUserId: req.userId ? String(req.userId) : undefined,
  });
  if (!userId || userId === "undefined") {
    throwError(422, "User ID is required");
  }
  validateObjectId(userId, "User ID");

  // 2. Check authorization
  if (String(userId) !== String(req.userId) && req.role !== ROLES.ADMIN) {
    throwError(403, "You can only update your own profile or need admin access");
  }

  // 3. Process form data fields
  let updateData = processFormDataFields(req.body);

  // 4. Handle availability source
  const availabilitySource = updateData.availabilitySource || 
    (req.role === ROLES.ADMIN ? "admin_panel" : "mate_app");
  delete updateData.availabilitySource;

  // 5. Validate
  const { error } = validateUpdateUser(updateData);
  if (error) {
    throwError(422, error.details.map(d => d.message).join(", "));
  }

  // 6. Update user
  const updatedUser = await updateUserById(
    userId, 
    updateData, 
    req.files?.image, 
    { availabilitySource }
  );

  // 7. Return response
  return sendSuccess(res, 200, "User profile updated successfully", updatedUser);
});