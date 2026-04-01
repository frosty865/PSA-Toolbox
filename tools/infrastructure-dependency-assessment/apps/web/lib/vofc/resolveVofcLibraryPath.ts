/**
 * Canonical VOFC library path resolution.
 * Order: 1) VOFC_LIBRARY_PATH env, 2) resources/ (standalone ADT), 3) apps/web/assets/data/, 4) throw.
 * Pass projectRoot when running in Next (e.g. getRepoRoot()) so resolution is correct regardless of cwd.
 */
import fs from "fs";
import path from "path";

function getDefaultProjectRoot(): string {
  // From apps/web/lib/vofc: go up to repo root (lib -> web -> apps -> root).
  return path.resolve(__dirname, "..", "..", "..", "..");
}

export function resolveVofcLibraryPath(projectRoot?: string): string {
  const envPath = process.env.VOFC_LIBRARY_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return path.resolve(envPath);
  }

  const root = projectRoot ?? getDefaultProjectRoot();
  const standalonePath = path.join(root, "resources", "VOFC_Library.xlsx");
  if (fs.existsSync(standalonePath)) return standalonePath;

  const monorepoPath = path.join(
    root,
    "apps",
    "web",
    "assets",
    "data",
    "VOFC_Library.xlsx"
  );
  if (fs.existsSync(monorepoPath)) return monorepoPath;

  throw new Error(
    [
      "VOFC library file not found.",
      "Expected at:",
      monorepoPath,
      " or ",
      standalonePath,
      "",
      "Fix:",
      "• Standalone ADT: place VOFC_Library.xlsx in resources/",
      "• Monorepo: place VOFC_Library.xlsx at apps/web/assets/data/",
      "• OR set VOFC_LIBRARY_PATH to the absolute file path",
    ].join("\n")
  );
}
