const fs = require("fs");
const path = require("path");

const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");
const LATEST_META_PATH = path.join(SNAPSHOT_DIR, "latest.json");

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

fs.writeFileSync(LATEST_META_PATH, JSON.stringify({
  status: "running",
  updatedAt: new Date().toISOString()
}, null, 2));

console.log("⏳ Marked snapshot as RUNNING");
