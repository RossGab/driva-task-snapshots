/**
 * Snapshot DRIVERS
 *
 * - Runs only 6:00 AM – 9:59 PM PH time
 * - Writes snapshots/drivers.json
 * - Updates snapshots/drivers-latest.json
 * - FORCE_RUN=1 bypasses time restriction
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

const DRIVERS_PATH = path.join(SNAPSHOT_DIR, "drivers.json");
const DRIVERS_META_PATH = path.join(
  SNAPSHOT_DIR,
  "drivers-latest.json"
);

/* =========================
   TIME HELPERS (SAFE)
========================= */

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
   SNAPSHOT DRIVERS
========================= */
async function snapshotDrivers() {
  console.log("👤 Snapshot drivers started");

  const snap = await db.ref("drivers").get();

  if (!snap.exists()) {
    console.log("⚠️ No drivers found");
    return false;
  }

  const drivers = snap.val() || {};

  fs.writeFileSync(
    DRIVERS_PATH,
    JSON.stringify(drivers, null, 2)
  );

  console.log(
    `✅ Saved drivers.json (${Object.keys(drivers).length} drivers)`
  );

  return true;
}

/* =========================
   WRITE META
========================= */
function writeDriversMeta() {
  const meta = {
    updatedAt: new Date().toISOString(), // ✅ canonical UTC
  };

  fs.writeFileSync(
    DRIVERS_META_PATH,
    JSON.stringify(meta, null, 2)
  );

  console.log("📦 Updated drivers-latest.json");
}

/* =========================
   MAIN
========================= */
(async () => {
  console.log("📸 Driver snapshot job started");

  const hourPH = phHour();

  if (!FORCE_RUN && (hourPH < 6 || hourPH > 21)) {
    console.log("⏭️ Skipped (outside 6AM–9PM PH)");
    await admin.app().delete();
    process.exit(0);
  }

  try {
    const ok = await snapshotDrivers();

    if (ok) {
      writeDriversMeta();
    } else {
      console.log("⚠️ Driver snapshot not written");
    }

    console.log("✅ Driver snapshot completed");
  } catch (err) {
    console.error("❌ Driver snapshot failed:", err);
    process.exitCode = 1;
  } finally {
    try {
      await admin.app().delete();
    } catch {}
    process.exit();
  }
})();
