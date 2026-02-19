/**
 * Snapshot DAY 8+
 *
 * - Covers ALL dates where daysAgo >= 8
 * - Runs once per day (6:00–6:59 AM PH)
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes one JSON per date (YYYYMMDD.json)
 * - Guaranteed clean exit
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
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

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
   TIME HELPERS (PH)
========================= */
function nowPH() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
}

function daysAgoFromKey(dateKey) {
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6)) - 1;
  const d = Number(dateKey.slice(6, 8));

  const target = new Date(y, m, d);
  const diffMs = nowPH() - target;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isWithinRunWindow() {
  const hour = nowPH().getHours();
  return hour === 6; // 6:00–6:59 AM PH
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

  const taskIds = Object.keys(idsSnap.val());
  const tasks = {};

  for (const id of taskIds) {
    const snap = await db.ref(`tasks/${id}`).get();
    if (snap.exists()) {
      tasks[id] = snap.val();
    }
  }

  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${dateKey}.json`),
    JSON.stringify(tasks, null, 2)
  );

  console.log(`✅ Saved ${dateKey}.json (${taskIds.length} tasks)`);
  return true;
}

/* =========================
   MAIN
========================= */
(async () => {
  console.log("📸 Snapshot DAY 8+ job started");

  if (!FORCE_RUN && !isWithinRunWindow()) {
    console.log("⏭️ Skipped (not within 6AM PH window)");
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
      const daysAgo = daysAgoFromKey(dateKey);

      if (daysAgo < 8) continue;

      const written = await snapshotDate(dateKey);
      if (written) processed++;
    }

    console.log(`✅ Snapshot DAY 8+ completed (${processed} dates processed)`);
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
