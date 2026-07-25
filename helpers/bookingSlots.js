const { getISTDayKey } = require("./istDate");

const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 15;
const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

/** Parse YYYY-MM-DD as a calendar day (not a host-local midnight). */
function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** Today’s date key in IST (product timezone). */
function toDateKey(date = new Date()) {
  return getISTDayKey(date);
}

/** Wall-clock IST hour/minute on dateKey → absolute UTC Date. */
function istWallClockToDate(dateKey, hour, minute) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const date = new Date(`${dateKey}T${hh}:${mm}:00${IST_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatSlotLabel(date) {
  return date.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildAllSlotsForDate(dateKey) {
  if (!parseDateKey(dateKey)) return [];

  const slots = [];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const slotDate = istWallClockToDate(dateKey, hour, minute);
      if (!slotDate) continue;
      slots.push({
        id: `${dateKey}-${hour}-${minute}`,
        dateKey,
        startsAt: slotDate.toISOString(),
        label: formatSlotLabel(slotDate),
        hour,
        minute,
      });
    }
  }

  return slots;
}

function slotIdToDate(dateKey, slotId) {
  const parts = String(slotId || "").split("-");
  if (parts.length < 5) return null;
  const hour = Number(parts[3]);
  const minute = Number(parts[4]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return istWallClockToDate(dateKey, hour, minute);
}

function slotIdToLabel(dateKey, slotId) {
  const date = slotIdToDate(dateKey, slotId);
  return date ? formatSlotLabel(date) : "";
}

module.exports = {
  SLOT_START_HOUR,
  SLOT_END_HOUR,
  SLOT_INTERVAL_MINUTES,
  IST_TIMEZONE,
  parseDateKey,
  toDateKey,
  formatSlotLabel,
  buildAllSlotsForDate,
  slotIdToDate,
  slotIdToLabel,
  istWallClockToDate,
};
