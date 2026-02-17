/**
 * Firebase → GitHub snapshot script
 * Reads tasks + tasksByDate and writes JSON snapshots
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 🔐 Load service account from GitHub Secret
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://driva-pwa-default-rtdb.firebaseio.com",
});

const db = admin.database();

const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");

// Ensure snapshot dir exists
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Philippine time helper
function getPHDate(offsetDays = 0) {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dateKey(dateStr) {
  return dateStr.replace(/-/g, ""); // YYYYMMDD
}

async function run() {
  console.log("📸 Snapshot start");

  const ranges = [
    { days: 0, label: "today" },
    { days: 1, label: "today-1" },
    { days: 2, label: "today-2" },
    { days: 3, label: "today-3" },
    { days: 7, label: "older" }, // today-4 and beyond
  ];

  for (const r of ranges) {
    const dateStr = getPHDate(r.days);
    const dk = dateKey(dateStr);

    console.log(`📅 Fetching ${r.label} (${dk})`);

    const idsSnap = await db.ref(`tasksByDate/${dk}`).get();
    if (!idsSnap.exists()) continue;

    const taskIds = Object.keys(idsSnap.val());
    const tasks = {};

    for (const id of taskIds) {
      const snap = await db.ref(`tasks/${id}`).get();
      if (snap.exists()) {
        tasks[id] = snap.val();
      }
    }

    const outPath = path.join(SNAPSHOT_DIR, `${r.label}.json`);
    fs.writeFileSync(outPath, JSON.stringify(tasks, null, 2));
  }

  // Full index (optional but useful)
  const allTasksSnap = await db.ref("tasks").get();
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, "all.json"),
    JSON.stringify(allTasksSnap.val() || {}, null, 2)
  );

  console.log("✅ Snapshot complete");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
