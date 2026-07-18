/**
 * Seed sample therapy cohorts (skips if theme already exists).
 * Usage: node scripts/seedTherapy.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const TherapyCohort = require("../models/TherapyCohort");

const SEED = [
  {
    theme: "Managing Anxiety",
    tag: "Anxiety",
    band: "#7c6ba8",
    description:
      "A structured 6-week group for people whose anxiety is affecting daily life, sleep, and relationships.",
    approach: "CBT & Mindfulness",
    psychologistLabel: "MA Psychology, 7 yrs",
    sessionsCount: 6,
    durationMinutes: 90,
    dayLabel: "Tuesdays",
    totalSeats: 8,
    price: 2400,
    who: "Working professionals and students 22–38 experiencing persistent anxiety or overthinking.",
  },
  {
    theme: "Processing Grief",
    tag: "Grief",
    band: "#5f4f86",
    description:
      "For those navigating loss — of a person, a relationship, or a life they had planned.",
    approach: "Narrative & Attachment",
    psychologistLabel: "MPhil Psychology, 9 yrs",
    sessionsCount: 6,
    durationMinutes: 90,
    dayLabel: "Wednesdays",
    totalSeats: 8,
    price: 2400,
    who: "Open to anyone processing any kind of significant loss. No timeline on grief.",
  },
  {
    theme: "Burnout Recovery",
    tag: "Burnout",
    band: "#7c6ba8",
    description:
      "For people running on empty — understand why you burned out and how to rebuild.",
    approach: "ACT (Acceptance & Commitment)",
    psychologistLabel: "MA Psychology, 6 yrs",
    sessionsCount: 6,
    durationMinutes: 90,
    dayLabel: "Thursdays",
    totalSeats: 8,
    price: 2400,
    who: "Professionals 26–40 who are exhausted, disconnected, and struggling to find meaning in work.",
  },
  {
    theme: "Relationship Patterns",
    tag: "Relationships",
    band: "#a593cc",
    description:
      "Understanding why you attract the same dynamics — and how to change the pattern.",
    approach: "Attachment & Psychodynamic",
    psychologistLabel: "MPhil Clinical Psychology",
    sessionsCount: 6,
    durationMinutes: 90,
    dayLabel: "Saturdays",
    totalSeats: 8,
    price: 2400,
    who: "Anyone 24–40 who finds themselves in recurring relationship patterns they want to break.",
  },
];

function nextWeekdaySlots(dayLabel, count, durationMinutes) {
  const map = {
    Sundays: 0,
    Mondays: 1,
    Tuesdays: 2,
    Wednesdays: 3,
    Thursdays: 4,
    Fridays: 5,
    Saturdays: 6,
  };
  const target = map[dayLabel] ?? 2;
  const slots = [];
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  for (let i = 0; i < count; i += 1) {
    const scheduledAt = new Date(d);
    scheduledAt.setDate(d.getDate() + i * 7);
    slots.push({
      label: `Session ${i + 1}`,
      scheduledAt,
      durationMinutes,
      meetingUrl: "",
      meetingPassword: "",
    });
  }
  return slots;
}

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URL not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  let created = 0;
  let skipped = 0;
  for (const item of SEED) {
    const exists = await TherapyCohort.findOne({
      theme: item.theme,
      isDeleted: false,
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    const slots = nextWeekdaySlots(
      item.dayLabel,
      item.sessionsCount,
      item.durationMinutes,
    );
    const cohort = await TherapyCohort.create({
      ...item,
      slots,
      takenSeats: 0,
      status: "open",
      isActive: true,
    });
    for (const slot of cohort.slots) {
      slot.agoraChannelName = `therapy_${cohort._id}_${slot._id}`;
    }
    await cohort.save();
    created += 1;
    console.log("Created:", item.theme);
  }
  console.log(`Done. created=${created} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
