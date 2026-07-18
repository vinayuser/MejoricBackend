/**
 * Seed communities into MongoDB (source of truth for the user app).
 *
 * Usage:
 *   cd Server && npm run seed:communities
 *
 * Skips any community whose name already exists.
 * Frontend must load communities from the API — do not ship static catalogs.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Community = require("../models/Community");

const SEED = [
  {
    emoji: "🌀",
    name: "The Spiral Space",
    description:
      "When your mind races before meetings, at 3am, or for no reason at all.",
    who: "Persistent overthinking, social anxiety, anxious attachment.",
    memberCount: 0,
    color: "#7c6ba8",
    avatarColors: ["#7c6ba8", "#a593cc", "#5f4f86"],
  },
  {
    emoji: "🌧️",
    name: "The Grey Days Room",
    description:
      "For the heaviness that is hard to name — the days when getting out of bed is the win.",
    who: "Low mood, depression, numbness, or the feeling that nothing matters.",
    memberCount: 0,
    color: "#6B7FCC",
    avatarColors: ["#6B7FCC", "#7c6ba8", "#5B8BCC"],
  },
  {
    emoji: "🗣️",
    name: "Say It Clearly",
    description:
      "Speaking up without shrinking, people-pleasing, or over-explaining.",
    who: "Difficulty saying no, passive communication, fear of conflict or rejection.",
    memberCount: 0,
    color: "#7c6ba8",
    avatarColors: ["#7c6ba8", "#a593cc", "#5f4f86"],
  },
  {
    emoji: "💼",
    name: "The Boardroom Couch",
    description:
      "What happens after the meeting ends — the pressure nobody in the office talks about.",
    who: "Workplace anxiety, toxic environments, career confusion, professional identity.",
    memberCount: 0,
    color: "#4A6B8B",
    avatarColors: ["#4A6B8B", "#7c6ba8", "#6B7FCC"],
  },
  {
    emoji: "🔋",
    name: "Running on Empty",
    description:
      "For when you have given everything to everyone and have nothing left.",
    who: "Chronic stress, burnout, exhaustion that sleep does not fix.",
    memberCount: 0,
    color: "#C4553E",
    avatarColors: ["#C4553E", "#7c6ba8", "#a593cc"],
  },
  {
    emoji: "⚡",
    name: "Wired Differently",
    description:
      "Every brain has its own operating system. This is a space that actually gets yours.",
    who: "ADHD, autism, dyslexia, sensory sensitivities, or any neurodivergent experience.",
    memberCount: 0,
    color: "#6B4FB5",
    avatarColors: ["#6B4FB5", "#7c6ba8", "#5f4f86"],
  },
  {
    emoji: "🔮",
    name: "Still Becoming",
    description:
      "The in-between is real — between who you were and who you are trying to be.",
    who: "Identity confusion, quarter-life crisis, cultural pressure, major life transitions.",
    memberCount: 0,
    color: "#5f4f86",
    avatarColors: ["#5f4f86", "#7c6ba8", "#a593cc"],
  },
  {
    emoji: "🪞",
    name: "The Mirror Room",
    description:
      "Rebuilding a honest, kinder relationship with yourself — no performance required.",
    who: "Low self-worth, imposter syndrome, comparison, self-critical inner voice.",
    memberCount: 0,
    color: "#a593cc",
    avatarColors: ["#a593cc", "#7c6ba8", "#5f4f86"],
  },
  {
    emoji: "🌱",
    name: "New Chapter",
    description:
      "After loss, failure, or choosing differently — every restart is an act of courage.",
    who: "Rebuilding after breakups, job loss, illness, divorce, or big life change.",
    memberCount: 0,
    color: "#4A8B6B",
    avatarColors: ["#4A8B6B", "#7c6ba8", "#5f4f86"],
  },
  {
    emoji: "🤱",
    name: "The Village",
    description:
      "The love nobody warned you about — and the exhaustion nobody prepared you for.",
    who: "Parents, mothers, fathers navigating guilt, depletion, and the invisible load.",
    memberCount: 0,
    color: "#7c6ba8",
    avatarColors: ["#7c6ba8", "#a593cc", "#5f4f86"],
  },
  {
    emoji: "🌙",
    name: "The Long Table",
    description:
      "A seat is always open here — for those who feel invisible in a crowded room.",
    who: "Loneliness in a new city, social isolation, difficulty making adult friendships.",
    memberCount: 0,
    color: "#a593cc",
    avatarColors: ["#a593cc", "#5f4f86", "#7c6ba8"],
  },
  {
    emoji: "🕊️",
    name: "Holding Space",
    description:
      "No timeline. No pressure to move on. Your grief does not need to be explained here.",
    who: "Loss of a person, relationship, dream, or version of a life you had planned.",
    memberCount: 0,
    color: "#6B8EA8",
    avatarColors: ["#6B8EA8", "#7c6ba8", "#5f4f86"],
  },
  {
    emoji: "🌿",
    name: "Hearts & Humans",
    description:
      "Love, friendship, family — the most important and most complicated work we do.",
    who: "Romantic struggles, difficult families, friendship breakdowns, attachment wounds.",
    memberCount: 0,
    color: "#5f4f86",
    avatarColors: ["#5f4f86", "#7c6ba8", "#a593cc"],
  },
  {
    emoji: "🏳️‍🌈",
    name: "Open Colours",
    description:
      "An affirming, moderated space — you belong here exactly as you are.",
    who: "LGBTQ+ individuals seeking community, safe venting, and shared understanding.",
    memberCount: 0,
    color: "#a593cc",
    avatarColors: ["#a593cc", "#5f4f86", "#7c6ba8"],
  },
  {
    emoji: "📚",
    name: "The Study Table",
    description:
      "Exams, placements, parental expectations — and feeling like everyone else has it figured out.",
    who: "Students navigating academic pressure, career anxiety, and finding their own path.",
    memberCount: 0,
    color: "#7c6ba8",
    avatarColors: ["#7c6ba8", "#5f4f86", "#a593cc"],
  },
  {
    emoji: "☕",
    name: "The Common Room",
    description:
      "Drop in, say hello, share something small. No agenda, no pressure.",
    who: "Anyone looking for light connection, casual conversation, or a gentle start.",
    memberCount: 0,
    color: "#7c6ba8",
    avatarColors: ["#7c6ba8", "#a593cc", "#5f4f86"],
  },
];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const uri =
    process.env.MONGO_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URL / MONGODB_URI / MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  let created = 0;
  let skipped = 0;

  for (const item of SEED) {
    const exists = await Community.findOne({
      name: item.name,
      isDeleted: false,
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await Community.create({
      ...item,
      slug: slugify(item.name),
      isActive: true,
    });
    created += 1;
    console.log("Created:", item.name);
  }

  console.log(`Done. created=${created} skipped=${skipped}`);
  console.log("Load communities from GET /communities/list — not frontend static data.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
