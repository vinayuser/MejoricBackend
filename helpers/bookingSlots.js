const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 15;

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotLabel(date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildAllSlotsForDate(dateKey) {
  const date = parseDateKey(dateKey);
  const slots = [];

  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);
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
  const parts = slotId.split("-");
  if (parts.length < 5) return null;
  const hour = Number(parts[3]);
  const minute = Number(parts[4]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const date = parseDateKey(dateKey);
  date.setHours(hour, minute, 0, 0);
  return date;
}

module.exports = {
  SLOT_START_HOUR,
  SLOT_END_HOUR,
  SLOT_INTERVAL_MINUTES,
  parseDateKey,
  toDateKey,
  formatSlotLabel,
  buildAllSlotsForDate,
  slotIdToDate,
};
