/**
 * Snapshot DAY 8+
 *
 * - Covers ALL dates where daysAgo >= 8
 * - Runs once per day (6:00–6:59 AM PH)
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes one JSON per date (YYYYMMDD.json)
 * - ✅ UTC-safe, PH-correct
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

/* =========================
   FLAGS
========================= */
const FORCE_RUN = process.env.FORCE_RUN === "1";

/* =========================
   FIREBASE INIT
========================= */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://driva-pwa-default-rtdb.firebaseio.com",
});

const db = admin.database();

/* =========================
   SNAPSHOT DIR
========================= */
const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

/* =========================
   TIME HELPERS (SAFE)
========================= */

// PH date key only (YYYYMMDD)
function todayPHKey() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  }).replace(/-/g, "");
}

// PH hour only
function phHour() {
  return Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    })
  );
}

// daysAgo computed via PH date keys (SAFE)
function daysAgoFromKey(dateKey) {
  const today = todayPHKey();
  const toDate = k =>
    new Date(`${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6,8)}T00:00:00+08:00`);

  const diffMs = toDate(today) - toDate(dateKey);
  return Math.floor(diffMs / 86400000);
}

function isWithinRunWindow() {
  return phHour() === 6; // 6:00–6:59 AM PH
}

/* =========================
   SNAPSHOT ONE DATE
========================= */
async function snapshotDate(dateKey) {
  console.log(`📅 Snapshot ${dateKey}`);

  const idsSnap = await db.ref(`tasksByDate/${dateKey}`).get();
  if (!idsSnap.exists()) {
    console.log(`⚠️ No tasks for ${dateKey}`);
    return false;
  }

  const tasks = {};
  for (const id of Object.keys(idsSnap.val())) {
    const snap = await db.ref(`tasks/${id}`).get();
    if (snap.exists()) tasks[id] = snap.val();
  }

  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${dateKey}.json`),
    JSON.stringify(tasks, null, 2)
  );

  console.log(`✅ Saved ${dateKey}.json (${Object.keys(tasks).length} tasks)`);
  return true;
}

/* =========================
   MAIN
========================= */
(async () => {
  console.log("📸 Snapshot DAY 8+ job started");

  if (!FORCE_RUN && !isWithinRunWindow()) {
    console.log("⏭️ Skipped (not 6AM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  try {
    const allDatesSnap = await db.ref("tasksByDate").get();
    if (!allDatesSnap.exists()) {
      console.log("⚠️ No tasksByDate found");
      process.exit(0);
    }

    const dateKeys = Object.keys(allDatesSnap.val()).sort();
    let processed = 0;

    for (const dateKey of dateKeys) {
      if (daysAgoFromKey(dateKey) < 8) continue;

      if (await snapshotDate(dateKey)) {
        processed++;
      }
    }

    console.log(`✅ Snapshot DAY 8+ completed (${processed} dates)`);
  } catch (err) {
    console.error("❌ Snapshot DAY 8+ failed:", err);
    process.exitCode = 1;
  } finally {
    try {
      await admin.app().delete();
    } catch {}
    process.exit();
  }
})();
