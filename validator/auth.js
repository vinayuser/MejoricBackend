const Joi = require("joi");

exports.validateForgotPassword = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    platform: Joi.string().valid("WEB", "APP", "ADMIN").required(),
    role: Joi.string().optional(),
  });
  return schema.validate(data, { abortEarly: false });
};

exports.validateResetPassword = (data) => {
  const schema = Joi.object({
    token: Joi.string().required(),
    email: Joi.string().email().required(),
    newPassword: Joi.string().min(6).required(),
    confirmNewPassword: Joi.string()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({
        "any.only": "newPassword and confirmNewPassword must be same",
      }),
    role: Joi.string().optional(),
  });
  return schema.validate(data, { abortEarly: false });
};
