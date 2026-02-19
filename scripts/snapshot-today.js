/**
 * Snapshot TODAY & TODAY-1
 * - Runs only 6AM–9PM PH
 * - FORCE_RUN=1 bypasses time restriction
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
   TIME HELPERS (PH)
========================= */
function nowPH() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
}

function phDate(daysAgo = 0) {
  const d = nowPH();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/* =========================
   SNAPSHOT ONE DATE
========================= */
async function snapshotDate(dateKey) {
  const idsSnap = await db.ref(`tasksByDate/${dateKey}`).get();
  if (!idsSnap.exists()) {
    console.log(`⚠️ No tasks for ${dateKey}`);
    return;
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
}

/* =========================
   MAIN
========================= */
(async () => {
  const now = nowPH();
  const hour = now.getHours();

  console.log("📸 Snapshot TODAY job");

  if (!FORCE_RUN && (hour < 6 || hour > 21)) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  await snapshotDate(phDate(0)); // today
  await snapshotDate(phDate(1)); // today-1

  console.log("✅ Snapshot TODAY completed");

  await admin.app().delete();
  process.exit(0);
})().catch(async err => {
  console.error("❌ Snapshot failed:", err);
  try { await admin.app().delete(); } catch {}
  process.exit(1);
});
