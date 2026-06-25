const Joi = require("joi");

exports.validateCreateBooking = (payload) => {
  const schema = Joi.object({
    mentorId: Joi.string().required(),
    scheduledAt: Joi.string().isoDate().required(),
    slotLabel: Joi.string().required(),
    dateKey: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
    slotId: Joi.string().required(),
    guestDetails: Joi.object({
      fullName: Joi.string().trim().min(2).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().trim().min(10).required(),
      gender: Joi.string().allow(""),
      age: Joi.string().allow(""),
      budget: Joi.string().allow(""),
      referral: Joi.string().allow(""),
      supportNeeds: Joi.string().allow(""),
    }).required(),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateAdminBookingsQuery = (payload) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid(
      "scheduled",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ),
    mentorId: Joi.string(),
    search: Joi.string().trim().allow(""),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateBookedSlotsQuery = (payload) => {
  const schema = Joi.object({
    dateKey: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateAvailabilityQuery = (payload) => {
  const schema = Joi.object({
    dateKey: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateAvailableDatesQuery = (payload) => {
  const schema = Joi.object({
    year: Joi.number().integer().min(2024).max(2100).required(),
    month: Joi.number().integer().min(1).max(12).required(),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateSaveAvailability = (payload) => {
  const schema = Joi.object({
    dateKey: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
    slotIds: Joi.array().items(Joi.string()).default([]),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateMentorAppointmentsQuery = (payload) => {
  const schema = Joi.object({
    tab: Joi.string().valid("upcoming", "completed", "past").default("upcoming"),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  });

  return schema.validate(payload, { abortEarly: false });
};

exports.validateUserBookingsQuery = (payload) => {
  const schema = Joi.object({
    tab: Joi.string().valid("upcoming", "past").default("upcoming"),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  });

  return schema.validate(payload, { abortEarly: false });
};
