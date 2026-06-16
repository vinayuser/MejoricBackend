const { sendLoginOtpMail } = require("./sendLoginOtpMail");
const {
  sendOtpVerificationSuccessMail,
} = require("./sendOtpVerificationSuccessMail");
const { sendResetPasswordMail } = require("./sendResetPasswordMail");
const { sendSignupAgreementMail } = require("./sendSignupAgreementMail");

module.exports = {
  sendLoginOtpMail,
  sendOtpVerificationSuccessMail,
  sendResetPasswordMail,
  sendSignupAgreementMail,
};
