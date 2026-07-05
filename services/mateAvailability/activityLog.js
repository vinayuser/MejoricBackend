const mongoose = require("mongoose");
const {
  MateActivityLog,
  COLLECTION_NAME,
  CAPPED_MAX,
  CAPPED_SIZE_BYTES,
} = require("../../models/MateActivityLog");

let collectionReady = false;

async function ensureMateActivityLogCollection() {
  if (collectionReady) return;

  const db = mongoose.connection.db;
  if (!db) return;

  const existing = await db
    .listCollections({ name: COLLECTION_NAME })
    .toArray();

  if (!existing.length) {
    await db.createCollection(COLLECTION_NAME, {
      capped: true,
      size: CAPPED_SIZE_BYTES,
      max: CAPPED_MAX,
    });
    console.log(
      `✅ Created capped collection ${COLLECTION_NAME} (max ${CAPPED_MAX} docs)`,
    );
  }

  collectionReady = true;
}

exports.logMateActivity = async ({
  mateUserId,
  mateName,
  mobile,
  activity,
  at = new Date(),
  dayKey,
  source = "mate_app",
  durationSeconds = null,
}) => {
  await ensureMateActivityLogCollection();

  return MateActivityLog.create({
    mateUserId,
    mateName: mateName || "",
    mobile: mobile || null,
    activity,
    at,
    dayKey,
    source,
    durationSeconds,
  });
};

exports.ensureMateActivityLogCollection = ensureMateActivityLogCollection;
