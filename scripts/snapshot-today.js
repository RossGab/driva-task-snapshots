/**
 * Snapshot TODAY & TODAY-1
 * - Runs only 6AM–9PM PH
 * - FORCE_RUN=1 bypasses time restriction
 * - Writes snapshots/latest.json for freshness tracking
 * - ✅ UTC-safe (NO double timezone conversion)
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
   TIME HELPERS (SAFE)
========================= */

// PH date key ONLY (no Date math leakage)
function phDateKey(daysAgo = 0) {
  const ph = new Date(
    new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" })
  );
  ph.setDate(ph.getDate() - daysAgo);
  return ph.toISOString().slice(0, 10).replace(/-/g, "");
}

// PH hour ONLY for gating
function phHour() {
  return Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    })
  );
}

/* =========================
   SNAPSHOT ONE DATE
========================= */
async function snapshotDate(dateKey) {
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

  console.log(`✅ Saved ${dateKey}.json`);
  return true;
}

/* =========================
   WRITE latest.json (UTC ONLY)
========================= */
function writeLatestMeta(latestDate) {
  const meta = {
    latestDate,
    updatedAt: new Date().toISOString(), // ✅ PURE UTC
  };

  fs.writeFileSync(LATEST_META_PATH, JSON.stringify(meta, null, 2));
  console.log("📦 Updated latest.json");
}

/* =========================
   MAIN
========================= */
(async () => {
  const hourPH = phHour();

  console.log("📸 Snapshot TODAY job");

  if (!FORCE_RUN && (hourPH < 6 || hourPH > 21)) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  const todayKey = phDateKey(0);
  const yesterdayKey = phDateKey(1);

  let latestWritten = null;

  if (await snapshotDate(todayKey)) {
    latestWritten = todayKey;
  }

  if (await snapshotDate(yesterdayKey) && !latestWritten) {
    latestWritten = yesterdayKey;
  }

  if (latestWritten) {
    writeLatestMeta(latestWritten);
  } else {
    console.log("⚠️ No snapshots written, latest.json not updated");
  }

  console.log("✅ Snapshot TODAY completed");

  await admin.app().delete();
  process.exit(0);
})().catch(async err => {
  console.error("❌ Snapshot failed:", err);
  try { await admin.app().delete(); } catch {}
  process.exit(1);
});
