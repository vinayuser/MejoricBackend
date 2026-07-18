/** Staging / dev: skip Razorpay checkout and accept mock payment IDs. */
function isMockPaymentsEnabled() {
  return (
    process.env.ALLOW_MOCK_PAYMENTS === "true" ||
    process.env.IS_STAGING === "true"
  );
}

function isMockPaymentId(paymentId) {
  return Boolean(paymentId && String(paymentId).startsWith("mock_"));
}

function createMockOrderId(prefix = "order") {
  return `${prefix}_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createMockPaymentId() {
  return `mock_pay_${Date.now()}`;
}

module.exports = {
  isMockPaymentsEnabled,
  isMockPaymentId,
  createMockOrderId,
  createMockPaymentId,
};
