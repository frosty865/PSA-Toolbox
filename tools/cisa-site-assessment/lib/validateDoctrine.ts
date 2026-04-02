import fs from "fs";
import path from "path";

export function validateDoctrineOrThrow(doctrineDir: string) {
  const manifestPath = path.join(doctrineDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "[DOCTRINE ERROR] Missing doctrine manifest.json"
    );
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  );

  const files: string[] = fs.readdirSync(doctrineDir);

  const missing = manifest.required_files.filter(
    (f: string) => !files.includes(f)
  );

  if (missing.length > 0) {
    throw new Error(
      `[DOCTRINE ERROR] Missing required doctrine files: ${missing.join(", ")}`
    );
  }
}

