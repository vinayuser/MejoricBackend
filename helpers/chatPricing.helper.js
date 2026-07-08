/**
 * Chat pricing: ₹8/min per started minute.
 * Any partial minute counts as a full minute (e.g. 15 sec → 1 min, 1m 1s → 2 mins).
 */

function getPricePerMin() {
  return parseInt(process.env.CHAT_PRICE_PER_MIN, 10) || 8;
}

/** Billable minutes — ceil so even 1 extra second counts as a full minute. */
function getBillableMinutes(seconds) {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / 60);
}

/** Max chat seconds from wallet (full-minute blocks only). */
function getChatSecondsForBalance(balance, pricePerMin = getPricePerMin()) {
  if (!pricePerMin || balance < pricePerMin) return 0;
  return Math.floor(balance / pricePerMin) * 60;
}

/** Charge for session duration using per-started-minute billing. */
function getChatChargeForSeconds(seconds, pricePerMin = getPricePerMin()) {
  if (!pricePerMin || seconds <= 0) return 0;
  return getBillableMinutes(seconds) * pricePerMin;
}

/** Human-readable actual duration for receipts, e.g. "15 sec", "1 min 15 sec". */
function formatChatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  if (total === 0) return "0 sec";
  if (total < 60) return `${total} sec`;

  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const minLabel = mins === 1 ? "min" : "mins";

  if (secs === 0) return `${mins} ${minLabel}`;
  return `${mins} ${minLabel} ${secs} sec`;
}

/** Remaining chat seconds after mid-session recharge (per-started-minute billing). */
function getTimeLeftAfterRecharge(elapsedSeconds, balance, pricePerMin = getPricePerMin()) {
  if (!pricePerMin || balance <= 0) return 0;
  const billableMinutes = getBillableMinutes(elapsedSeconds);
  const remainingInCurrentMinute = Math.max(0, billableMinutes * 60 - elapsedSeconds);
  const alreadyCharged = billableMinutes * pricePerMin;
  const availableBalance = Math.max(0, balance - alreadyCharged);
  const additionalMinutes = Math.floor(availableBalance / pricePerMin);
  return remainingInCurrentMinute + additionalMinutes * 60;
}

module.exports = {
  getPricePerMin,
  getBillableMinutes,
  getChatSecondsForBalance,
  getChatChargeForSeconds,
  getTimeLeftAfterRecharge,
  formatChatDuration,
};
