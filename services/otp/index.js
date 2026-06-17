const { sendOtpToMobile } = require("./sendOtpToMobile");
const { verifyOtpToMobile } = require("./verifyOtpToMobile");
const { formatMobileNumber } = require("./formatMobileNumber");

module.exports = { sendOtpToMobile, verifyOtpToMobile, formatMobileNumber };
