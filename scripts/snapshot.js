/**
 * Firebase → GitHub snapshot script
 * One file per dateKey (YYYYMMDD.json)
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 🔐 Load service account
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://driva-pwa-default-rtdb.firebaseio.com",
});

const db = admin.database();

const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

async function snapshotDate(dateKey) {
  console.log(`📅 Snapshot ${dateKey}`);

  const idsSnap = await db.ref(`tasksByDate/${dateKey}`).get();
  if (!idsSnap.exists()) {
    console.log(`⚠️ No tasks for ${dateKey}`);
    return;
  }

  const taskIds = Object.keys(idsSnap.val());
  const tasks = {};

  for (const id of taskIds) {
    const snap = await db.ref(`tasks/${id}`).get();
    if (snap.exists()) {
      tasks[id] = snap.val();
    }
  }

  const outPath = path.join(SNAPSHOT_DIR, `${dateKey}.json`);
  fs.writeFileSync(outPath, JSON.stringify(tasks, null, 2));
}

async function run() {
  console.log("📸 Snapshot start");

  // 🔑 STEP 1: Get ALL available dates
  const datesSnap = await db.ref("tasksByDate").get();
  if (!datesSnap.exists()) {
    console.log("⚠️ No tasksByDate found");
    return;
  }

  const dateKeys = Object.keys(datesSnap.val()).sort();

  console.log(`📦 Found ${dateKeys.length} date snapshots`);

  // 🔁 STEP 2: Snapshot each date
  for (const dk of dateKeys) {
    await snapshotDate(dk);
  }

  console.log("✅ Snapshot complete");
  await admin.app().delete();
  process.exit(0);
}

run().catch(async err => {
  console.error("❌ Snapshot failed:", err);
  try { await admin.app().delete(); } catch {}
  process.exit(1);
});
