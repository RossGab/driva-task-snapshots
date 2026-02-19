const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

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

function dateKey(daysAgo) {
  const d = nowPH();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function snapshot(dateKey) {
  const idsSnap = await db.ref(`tasksByDate/${dateKey}`).get();
  if (!idsSnap.exists()) return;

  const tasks = {};
  for (const id of Object.keys(idsSnap.val())) {
    const s = await db.ref(`tasks/${id}`).get();
    if (s.exists()) tasks[id] = s.val();
  }

  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${dateKey}.json`),
    JSON.stringify(tasks, null, 2)
  );
}

async function run() {
  const hour = nowPH().getHours();
  if (hour < 6 || hour > 21) return;
  if (hour % 2 !== 0) return;

  await snapshot(dateKey(2));
  await snapshot(dateKey(3));
}

run()
  .then(async () => {
    await admin.app().delete();
    process.exit(0);
  })
  .catch(async e => {
    console.error(e);
    await admin.app().delete();
    process.exit(1);
  });
