const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(`[DOCTRINE BUILD ERROR] ${msg}`);
  process.exit(1);
}

function main() {
  const doctrineDir = path.join(process.cwd(), "public", "doctrine");
  const manifestPath = path.join(doctrineDir, "manifest.json");

  if (!fs.existsSync(doctrineDir)) {
    fail(`Missing doctrine directory: ${doctrineDir}`);
  }
  if (!fs.existsSync(manifestPath)) {
    fail(`Missing manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = new Set(fs.readdirSync(doctrineDir));

  const missing = (manifest.required_files || []).filter((f) => !files.has(f));
  if (missing.length > 0) {
    fail(`Missing required doctrine files: ${missing.join(", ")}`);
  }

  console.log("[DOCTRINE BUILD CHECK] OK — doctrine mirrors present");
}

main();

