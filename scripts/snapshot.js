import fs from "fs";
import path from "path";
import admin from "firebase-admin";

// 🔐 Firebase service account (from GitHub Secret)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://driva-pwa-default-rtdb.firebaseio.com"
});

const db = admin.database();

// 🇵🇭 Philippine date
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Manila"
});

const SNAPSHOT_DIR = "snapshots";
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, `${today}.json`);

async function run() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR);
  }

  console.log("📥 Fetching tasks...");
  const tasksSnap = await db.ref("tasks").once("value");
  const tasks = tasksSnap.val() || {};

  console.log("📥 Fetching drivers...");
  const driversSnap = await db.ref("drivers").once("value");
  const drivers = driversSnap.val() || {};

  const snapshot = {
    generatedAt: new Date().toISOString(),
    date: today,
    taskCount: Object.keys(tasks).length,
    tasks,
    drivers
  };

  fs.writeFileSync(
    SNAPSHOT_FILE,
    JSON.stringify(snapshot, null, 2)
  );

  console.log(`✅ Snapshot created: ${SNAPSHOT_FILE}`);
}

run().catch(err => {
  console.error("❌ Snapshot failed:", err);
  process.exit(1);
});
