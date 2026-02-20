/**
 * Snapshot DRIVERS
 *
 * - Snapshots driver-related data
 * - Runs any time (lightweight)
 * - Writes:
 *   - snapshots/drivers/drivers.json
 *   - snapshots/drivers/driverStatus.json
 *   - snapshots/drivers/driverConfig.json
 *   - snapshots/drivers/latest.json
 *
 * - ✅ UTC-safe
 * - ✅ No date math bugs
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

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
   OUTPUT DIRS
========================= */
const BASE_DIR = path.join(__dirname, "..", "snapshots", "drivers");
fs.mkdirSync(BASE_DIR, { recursive: true });

const DRIVERS_PATH = path.join(BASE_DIR, "drivers.json");
const STATUS_PATH = path.join(BASE_DIR, "driverStatus.json");
const CONFIG_PATH = path.join(BASE_DIR, "driverConfig.json");
const LATEST_PATH = path.join(BASE_DIR, "latest.json");

/* =========================
   MAIN
========================= */
(async () => {
  console.log("🚗 Driver snapshot started");

  try {
    // 1️⃣ Drivers
    const driversSnap = await db.ref("drivers").get();
    const drivers = driversSnap.val() || {};

    // 2️⃣ Driver Status (GPS / lastSeen)
    const statusSnap = await db.ref("driverStatus").get();
    const driverStatus = statusSnap.val() || {};

    // 3️⃣ Driver UI Config
    const configSnap = await db.ref("config/driverUI/jobTypes").get();
    const driverConfig = configSnap.val() || {};

    // 4️⃣ Write files
    fs.writeFileSync(DRIVERS_PATH, JSON.stringify(drivers, null, 2));
    fs.writeFileSync(STATUS_PATH, JSON.stringify(driverStatus, null, 2));
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(driverConfig, null, 2));

    // 5️⃣ latest.json (UTC)
    fs.writeFileSync(
      LATEST_PATH,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

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
