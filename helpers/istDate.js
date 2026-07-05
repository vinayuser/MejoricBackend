const IST_TIMEZONE = "Asia/Kolkata";

exports.getISTDayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

exports.formatISTDateTime = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};

exports.formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

exports.getISTDayRange = (dayKey = exports.getISTDayKey()) => {
  const startOfDay = new Date(`${dayKey}T00:00:00+05:30`);
  const endOfDay = new Date(`${dayKey}T23:59:59.999+05:30`);
  return { startOfDay, endOfDay };
};
