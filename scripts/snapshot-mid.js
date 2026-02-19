/**
 * Snapshot TODAY-6 & TODAY-7
 *
 * - Covers days: today-6, today-7
 * - Runs only 6:00 AM – 9:59 PM PH time
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes one JSON per date (YYYYMMDD.json)
 * - ✅ UTC-safe
 * - ✅ PH-correct
 * - ❌ No string-based Date parsing
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
   TIME HELPERS (BULLETPROOF)
========================= */

/**
 * Returns PH date key (YYYYMMDD)
 */
function phDateKey(daysAgo = 0) {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() - daysAgo);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(base)
    .replace(/-/g, "");
}

/**
 * Returns PH hour (0–23)
 */
function phHour() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

function isWithinRunWindow() {
  const h = phHour();
  return h >= 6 && h <= 21; // 6AM–9PM PH
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
  console.log("📸 Snapshot TODAY-6 → TODAY-7 job started");

  if (!FORCE_RUN && !isWithinRunWindow()) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  try {
    await snapshotDate(phDateKey(6));
    await snapshotDate(phDateKey(7));

    console.log("✅ Snapshot TODAY-6 → TODAY-7 completed");
  } catch (err) {
    console.error("❌ Snapshot failed:", err);
    process.exitCode = 1;
  } finally {
    try {
      await admin.app().delete();
    } catch {}
    process.exit();
  }
})();
