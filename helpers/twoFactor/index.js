const {
  sendOtpToMobile,
  verifyOtpToMobile,
  formatMobileNumber,
} = require("../../services/otp");

module.exports = { sendOtpToMobile, verifyOtpToMobile, formatMobileNumber };
