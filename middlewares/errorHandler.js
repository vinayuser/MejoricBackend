const { CustomError, sendError } = require("../utils");

exports.errorHandler = (err, req, res, next) => {
  console.log("DEBUG: errorHandler called with err:", err);
  console.log("DEBUG: next is function:", typeof next === "function");
  if (res.headersSent) {
    console.log("DEBUG: headers already sent, calling next(err)");
    return next(err);
  }
  // ⭐ Handle Mongoose Validation Error (clean message)
  if (err.name === "ValidationError") {
    console.error("Mongoose Validation Error:", err);
    const cleanMessage = Object.values(err.errors)[0].message;
    return sendError(res, 422, cleanMessage);
  }
  // ⭐ Handle Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return sendError(res, 422, `${value} is already registered for ${field}`);
  }
  // ⭐ Handle CustomError
  if (err instanceof CustomError) {
    return sendError(res, err.statusCode, err.message);
  }
  // ⭐ Default fallback
  const status = err.status || 500;
  const message = err.message || "Something went wrong";
  console.error("⛔ Error:", err);
  return sendError(res, status, message);
};
