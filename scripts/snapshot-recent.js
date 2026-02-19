/**
 * Snapshot TODAY-2 to TODAY-5
 *
 * - Covers days: today-2 → today-5
 * - Runs only 6:00 AM – 9:59 PM PH time
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes one JSON per date (YYYYMMDD.json)
 * - DOES NOT touch latest.json
 * - ✅ UTC-safe (no double timezone conversion)
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

// PH date key only (no Date math leakage)
function phDateKey(daysAgo) {
  const ph = new Date(
    new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" })
  );
  ph.setDate(ph.getDate() - daysAgo);
  return ph.toISOString().slice(0, 10).replace(/-/g, "");
}

// PH hour only for gating
function phHour() {
  return Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    })
  );
}

function isWithinRunWindow() {
  const hour = phHour();
  return hour >= 6 && hour <= 21; // 6AM–9PM PH
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
  console.log("📸 Snapshot TODAY-2 → TODAY-5 job started");

  if (!FORCE_RUN && !isWithinRunWindow()) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  try {
    for (let daysAgo = 2; daysAgo <= 5; daysAgo++) {
      const dateKey = phDateKey(daysAgo);
      await snapshotDate(dateKey);
    }

    console.log("✅ Snapshot TODAY-2 → TODAY-5 completed");
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
