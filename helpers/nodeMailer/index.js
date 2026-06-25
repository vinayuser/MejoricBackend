const { sendLoginOtpMail } = require("./sendLoginOtpMail");
const {
  sendOtpVerificationSuccessMail,
} = require("./sendOtpVerificationSuccessMail");
const { sendResetPasswordMail } = require("./sendResetPasswordMail");
const { sendSignupAgreementMail } = require("./sendSignupAgreementMail");
const {
  sendBookingConfirmationToUser,
  sendBookingConfirmationToMentor,
  sendBookingReminderEmail,
} = require("./sendBookingEmails");

module.exports = {
  sendLoginOtpMail,
  sendOtpVerificationSuccessMail,
  sendResetPasswordMail,
  sendSignupAgreementMail,
  sendBookingConfirmationToUser,
  sendBookingConfirmationToMentor,
  sendBookingReminderEmail,
};
