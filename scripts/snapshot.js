/**
 * Firebase → GitHub snapshot script
 * - One snapshot JSON per date (YYYYMMDD.json)
 * - Reads ALL available dates from tasksByDate
 * - Frequency controlled by PH-time rules
 * - Manual runs can FORCE download
 * - Guaranteed clean exit (no hanging)
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

/* =========================
   FLAGS
========================= */
const FORCE_RUN = process.env.FORCE_RUN === "1";

/* =========================
   INIT FIREBASE
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

/* =========================
   FREQUENCY RULES (PH TIME)
========================= */
function shouldSnapshot(daysAgo, hourPH) {
  if (FORCE_RUN) return true; // 🔥 bypass all skips

  // Only 6am–10pm
  if (hourPH < 6 || hourPH > 22) return false;

  if (daysAgo <= 1) return true;
  if (daysAgo <= 3) return hourPH % 2 === 0;
  if (daysAgo <= 5) return hourPH % 3 === 0;
  if (daysAgo <= 7) return hourPH % 5 === 0;

  return hourPH === 6;
}

/* =========================
   SNAPSHOT ONE DATE
========================= */
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

  console.log(`✅ Saved ${dateKey}.json (${taskIds.length} tasks)`);
}

/* =========================
   MAIN
========================= */
async function run() {
  console.log("📸 Snapshot job started");

  const now = nowPH();
  const hourPH = now.getHours();

  // 🔑 Read ALL available dates from Firebase
  const allDatesSnap = await db.ref("tasksByDate").get();
  if (!allDatesSnap.exists()) {
    console.log("⚠️ No tasksByDate found");
    return;
  }

  const dateKeys = Object.keys(allDatesSnap.val())
    .sort()
    .reverse();

  for (const dateKey of dateKeys) {
    const daysAgo = daysAgoFromKey(dateKey);

    if (!FORCE_RUN && !shouldSnapshot(daysAgo, hourPH)) {
      console.log(
        `⏭️ Skip ${dateKey} (daysAgo=${daysAgo}, hour=${hourPH})`
      );
      continue;
    }

    await snapshotDate(dateKey);
  }

  console.log("✅ Snapshot job completed");
}

/* =========================
   EXEC + CLEAN EXIT
========================= */
run()
  .then(async () => {
    await admin.app().delete();
    process.exit(0);
  })
  .catch(async err => {
    console.error("❌ Snapshot failed:", err);
    try {
      await admin.app().delete();
    } catch {}
    process.exit(1);
  });
