const Razorpay = require("razorpay");

let instance;

function getRazorpay() {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_mock",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "mock_secret",
    });
  }
  return instance;
}

module.exports = getRazorpay();
