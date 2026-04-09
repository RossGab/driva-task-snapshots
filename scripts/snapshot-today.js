/**
 * Snapshot TODAY & TODAY-1
 *
 * - Runs only 6:00 AM – 9:59 PM PH time
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes snapshots/YYYYMMDD.json
 * - Updates snapshots/latest.json
 * - ✅ UTC-safe
 * - ✅ PH-time correct
 * - ✅ No locale-string Date parsing
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

const LATEST_META_PATH = path.join(SNAPSHOT_DIR, "latest.json");

/* =========================
   TIME HELPERS (TRULY SAFE)
========================= */

/**
 * Returns YYYYMMDD based on PH date
 * No Date parsing from strings
 * No ISO math on fake dates
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
   WRITE latest.json (UTC)
========================= */
function writeLatestMeta(latestDate) {
  const meta = {
    status: "done", // 🔥 ADD THIS
    latestDate,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(LATEST_META_PATH, JSON.stringify(meta, null, 2));
  console.log("📦 Updated latest.json");
}

/* =========================
   MAIN
========================= */
(async () => {
  console.log("📸 Snapshot TODAY job started");

  const hourPH = phHour();

  if (!FORCE_RUN && (hourPH < 6 || hourPH > 23)) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  try {
    const todayKey = phDateKey(0);
    // const yesterdayKey = phDateKey(1);

    let latestWritten = null;

    if (await snapshotDate(todayKey)) {
      latestWritten = todayKey;
    }

    // if (await snapshotDate(yesterdayKey) && !latestWritten) {
    //   latestWritten = yesterdayKey;
    // }

    if (latestWritten) {
        writeLatestMeta(latestWritten);
      } else {
        console.log("⚠️ No snapshots written");
      
        // 🔥 mark as error instead of leaving "running"
        fs.writeFileSync(LATEST_META_PATH, JSON.stringify({
          status: "error",
          updatedAt: new Date().toISOString()
        }, null, 2));
      }

    console.log("✅ Snapshot TODAY completed");
  } catch (err) {
  console.error("❌ Snapshot failed:", err);

  // 🔥 WRITE ERROR STATE
  fs.writeFileSync(LATEST_META_PATH, JSON.stringify({
    status: "error",
    updatedAt: new Date().toISOString()
  }, null, 2));

  process.exitCode = 1;
} finally {
    try {
      await admin.app().delete();
    } catch {}
    process.exit();
  }
})();
