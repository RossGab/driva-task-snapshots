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

async function run() {
  const hour = nowPH().getHours();
  if (hour !== 6) return;

  const allDates = await db.ref("tasksByDate").get();
  if (!allDates.exists()) return;

  for (const dateKey of Object.keys(allDates.val())) {
    const file = path.join(SNAPSHOT_DIR, `${dateKey}.json`);
    if (fs.existsSync(file)) continue;

    const ids = Object.keys(allDates.val()[dateKey]);
    const tasks = {};

    for (const id of ids) {
      const s = await db.ref(`tasks/${id}`).get();
      if (s.exists()) tasks[id] = s.val();
    }

    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));
  }
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
