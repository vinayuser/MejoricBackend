const Joi = require("joi");

exports.validateCreateWalletTopupOrder = (payload) => {
  const schema = Joi.object({
    amount: Joi.number().positive().required().messages({
      "number.base": "Amount must be numeric",
      "number.positive": "Amount must be greater than 0",
      "any.required": "Amount is required",
    }),
    currency: Joi.string().valid("INR", "USD").required().messages({
      "any.only": "Currency must be one of INR, USD",
      "any.required": "Currency is required",
    }),
  });
  return schema.validate(payload, { abortEarly: false });
};

exports.validateVerifyWalletTopup = (payload) => {
  const schema = Joi.object({
    razorpayOrderId: Joi.string().required().messages({
      "any.required": "razorpayOrderId is required",
    }),
    razorpayPaymentId: Joi.string().required().messages({
      "any.required": "razorpayPaymentId is required",
    }),
    razorpaySignature: Joi.string().required().messages({
      "any.required": "razorpaySignature is required",
    }),
    amount: Joi.number().optional(),
    currency: Joi.string().optional(),
  }).unknown();
  return schema.validate(payload, { abortEarly: false });
};

exports.validateWalletHistoryQuery = (payload) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    currency: Joi.string().valid("INR", "USD").optional(),
    status: Joi.string()
      .valid("PENDING", "SUCCESS", "FAILED", "REVERSED")
      .optional(),
    type: Joi.string().valid("CREDIT", "DEBIT").optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return schema.validate(payload, { abortEarly: false });
};

exports.validateAdminWalletHistoryQuery = (payload) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    userId: Joi.string().optional(),
    currency: Joi.string().valid("INR", "USD").optional(),
    status: Joi.string()
      .valid("PENDING", "SUCCESS", "FAILED", "REVERSED")
      .optional(),
    type: Joi.string().valid("CREDIT", "DEBIT").optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  });
  return schema.validate(payload, { abortEarly: false });
};
