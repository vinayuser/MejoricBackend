exports.formatMobileNumber = (mobile) => {
  const digits = String(mobile).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};
