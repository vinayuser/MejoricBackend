exports.sendSuccess = (
  res,
  statusCode = 200,
  message = "Success",
  data = {},
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

exports.sendTokenResponse = (res, statusCode, message, user, extraData = {}) => {
  const token = user.getSignedJwtToken();
  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  };

  // Convert to object and remove sensitive fields
  const userResponse = user.toObject ? user.toObject() : { ...user };
  delete userResponse.password;
  delete userResponse.otp;
  delete userResponse.resetPasswordTokenHash;
  delete userResponse.resetPasswordExpiresAt;

  res.cookie("token", token, options);
  return exports.sendSuccess(res, statusCode, message, {
    user: userResponse,
    token,
    ...extraData,
  });
};

exports.sendError = (
  res,
  statusCode = 500,
  message = "Something went wrong",
  errorData = {},
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: errorData,
  });
};
