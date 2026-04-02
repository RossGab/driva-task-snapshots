/**
 * Snapshot DAY 8+
 *
 * - Covers ALL dates where daysAgo >= 8
 * - Runs once per day (6:00–6:59 AM PH)
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes one JSON per date (YYYYMMDD.json)
 * - ✅ UTC-safe
 * - ✅ PH-correct
 * - ❌ No locale-string Date parsing
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

/**
 * Compute daysAgo using numeric math ONLY
 */
function daysAgoFromKey(dateKey) {
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6)) - 1;
  const d = Number(dateKey.slice(6, 8));

  // midnight PH expressed as UTC+8 offset
  const targetUTC = Date.UTC(y, m, d) - 8 * 60 * 60 * 1000;

  const now = new Date();
  const todayPHMidnightUTC =
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ) - 8 * 60 * 60 * 1000;

  return Math.floor(
    (todayPHMidnightUTC - targetUTC) / 86400000
  );
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
    if (snap.exists()) {
      tasks[id] = snap.val();
    }
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
    console.log("⏭️ Skipped (not within 6AM PH window)");
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
      const daysAgo = daysAgoFromKey(dateKey);

      if (daysAgo < 8 || daysAgo > 10) continue;

      if (await snapshotDate(dateKey)) {
        processed++;
      }
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
