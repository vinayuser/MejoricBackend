const { register } = require("./register");
const { login } = require("./login");
const { loginOrSignInWithEmail } = require("./loginOrSignInWithEmail");
const { verifyOtpWithEmail } = require("./verifyOtpWithEmail");
const { loginOrSignInWithMobile } = require("./loginOrSignInWithMobile");
const { verifyOtpWithMobile } = require("./verifyOtpWithMobile");
const { forgotPassword } = require("./forgotPassword");
const { resetPassword } = require("./resetPassword");
const { logout } = require("./logout");
const { guestLogin } = require("./guestLogin");
const { checkGuestLimit } = require("./checkGuestLimit");

module.exports = {
  register,
  login,
  logout,
  guestLogin,
  loginOrSignInWithEmail,
  verifyOtpWithEmail,
  loginOrSignInWithMobile,
  verifyOtpWithMobile,
  forgotPassword,
  resetPassword,
  checkGuestLimit,
};
