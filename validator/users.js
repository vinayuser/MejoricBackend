const Joi = require("joi");
// const objectId = require("./validJoiObjectId");

exports.validateUpdateUser = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Name should have at least {#limit} characters",
      "string.max": "Name should not exceed {#limit} characters",
    }),
    address: Joi.string().allow("").max(300).messages({
      "string.max": "Address cannot exceed {#limit} characters",
    }),
    dob: Joi.date().iso().messages({
      "date.format":
        "Date of birth must be a valid date in ISO format (YYYY-MM-DD)",
    }),
    email: Joi.string().email().messages({
      "string.email": "Please enter a valid email address",
    }),
    mobile: Joi.number().integer().min(1000000000).max(9999999999).messages({
      "number.base": "Mobile number must be numeric",
      "number.min": "Mobile number must be 10 digits",
      "number.max": "Mobile number must be 10 digits",
    }),
    // categoryId: objectId().messages({ "any.invalid": "Invalid categoryId" }),
    bio: Joi.string().allow("").max(300).messages({
      "string.max": "Bio cannot exceed {#limit} characters",
    }),
    pricePerMin: Joi.number().positive().messages({
      "number.base": "pricePerMin must be numeric",
      "number.positive": "pricePerMin must be > 0",
    }),
    pricePerHour: Joi.number().positive().messages({
      "number.base": "pricePerHour must be numeric",
      "number.positive": "pricePerHour must be > 0",
    }),
    priceUnit: Joi.string().valid("RUPEE", "USD").messages({
      "any.only": "priceUnit must be one of RUPEE, USD",
    }),
    experience: Joi.number().min(0).messages({
      "number.base": "experience must be numeric",
      "number.min": "experience must be >= 0",
    }),
    specifications: Joi.array().items(Joi.string().trim()).messages({
      "array.base": "specifications must be an array",
    }),
    languages: Joi.array().items(Joi.string().trim()).messages({
      "array.base": "languages must be an array",
    }),
    isAvailable: Joi.boolean().messages({
      "boolean.base": "isAvailable must be a boolean",
    }),
    isActive: Joi.boolean().messages({
      "boolean.base": "isActive must be a boolean",
    }),
    isOnline: Joi.boolean().messages({
      "boolean.base": "isOnline must be a boolean",
    }),
  });
  return schema.validate(data, { abortEarly: false });
};

exports.validateGetAllUsersQuery = (data) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
    }),
    role: Joi.string().allow("").messages({
      "string.base": "Role must be a string",
    }),
    sortBy: Joi.string().allow("").messages({
      "string.base": "sortBy must be a string",
    }),
    sortOrder: Joi.string().valid("asc", "desc").allow("").messages({
      "any.only": "sortOrder must be either asc or desc",
    }),
  }).unknown(true);
  return schema.validate(data, { abortEarly: false });
};
