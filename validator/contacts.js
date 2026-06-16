const Joi = require("joi");

exports.validateCreateContact = (data) => {
  const createSchema = Joi.object({
    name: Joi.string().min(3).max(120).required().messages({
      "string.min": "Name has minimum {#limit} characters",
      "string.max": "Name cannot exceed {#limit} characters",
      "any.required": "Name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
    mobile: Joi.number().integer().min(1000000000).max(9999999999).optional().messages({
      "number.base": "Mobile number must be numeric",
      "number.min": "Mobile number must be 10 digits",
      "number.max": "Mobile number must be 10 digits",
    }),
    subject: Joi.string().required().messages({
      "any.required": "Subject is required",
    }),
    message: Joi.string().required().messages({
      "any.required": "Message is required",
    }),
  });
  return createSchema.validate(data, { abortEarly: false });
};

exports.validateUpdateContact = (payload) => {
  const updateSchema = Joi.object({
    name: Joi.string().min(3).max(120).messages({
      "string.min": "Name has minimum {#limit} characters",
      "string.max": "Name cannot exceed {#limit} characters",
    }),
    email: Joi.string().email().messages({
      "string.email": "Please provide a valid email",
    }),
    mobile: Joi.number().integer().min(1000000000).max(9999999999).optional().messages({
      "number.base": "Mobile number must be numeric",
      "number.min": "Mobile number must be 10 digits",
      "number.max": "Mobile number must be 10 digits",
    }),
    subject: Joi.string().optional(),
    message: Joi.string().optional(),
  });
  return updateSchema.validate(payload, { abortEarly: false });
};

exports.validateGetAllContactsQuery = (payload) => {
  const getAllQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    search: Joi.string().optional(),
    name: Joi.string().optional(),
    email: Joi.string().optional(),
    mobile: Joi.number().integer().min(1000000000).max(9999999999).optional().messages({
      "number.base": "Mobile number must be numeric",
      "number.min": "Mobile number must be 10 digits",
      "number.max": "Mobile number must be 10 digits",
    }),
    subject: Joi.string().optional(),
    message: Joi.string().optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return getAllQuerySchema.validate(payload, { abortEarly: false });
};
