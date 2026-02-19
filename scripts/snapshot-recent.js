/**
 * Snapshot TODAY-2 to TODAY-5
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

function phDate(daysAgo) {
  const d = nowPH();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function allowedHour() {
  const h = nowPH().getHours();
  return h >= 6 && h <= 21;
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
    console.log("⏭️ Outside run window");
    process.exit(0);
  }

  for (let d = 2; d <= 5; d++) {
    await snapshotDate(phDate(d));
  }

  await admin.app().delete();
  process.exit(0);
})();
