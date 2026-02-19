/**
 * Snapshot DAY 8+
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const FORCE_RUN = process.env.FORCE_RUN === "1";
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://driva-pwa-default-rtdb.firebaseio.com",
});

const db = admin.database();
const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

function nowPH() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
}

function allowedHour() {
  const h = nowPH().getHours();
  return h === 6;
}

async function snapshotDate(dateKey) {
  const idsSnap = await db.ref(`tasksByDate/${dateKey}`).get();
  if (!idsSnap.exists()) return;

  const tasks = {};
  for (const id of Object.keys(idsSnap.val())) {
    const snap = await db.ref(`tasks/${id}`).get();
    if (snap.exists()) tasks[id] = snap.val();
  }

  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${dateKey}.json`),
    JSON.stringify(tasks, null, 2)
  );

  console.log(`✅ Saved ${dateKey}`);
}

(async () => {
  if (!FORCE_RUN && !allowedHour()) {
    console.log("⏭️ Not 6AM PH");
    process.exit(0);
  }

  const allDatesSnap = await db.ref("tasksByDate").get();
  if (!allDatesSnap.exists()) process.exit(0);

  const keys = Object.keys(allDatesSnap.val()).sort();
  for (let i = 8; i < keys.length; i++) {
    await snapshotDate(keys[i]);
  }

  await admin.app().delete();
  process.exit(0);
})();
