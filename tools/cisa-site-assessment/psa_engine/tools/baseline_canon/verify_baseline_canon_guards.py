from pathlib import Path
import sys

ENGINE_DIR = Path(__file__).parent.parent.parent
CANON_DIR = ENGINE_DIR / "doctrine" / "baseline_canon"

RUNTIME = CANON_DIR / "baseline_canon_runtime.v1.json"
SPINES = CANON_DIR / "baseline_spines.v1.json"
GUARD_DOC = CANON_DIR / "guards" / "legacy_baseline_guard.md"

# Adjust these strings to match actual legacy table names/paths in your codebase
FORBIDDEN_MARKERS = [
    "legacy_baseline_questions",
    "baseline_questions_legacy",
    "baseline_questions_registry_v2.json",   # if you want to force migration away from this as a source
    "legacy baseline tables",
]

def fail(msg):
    print("[FAIL]", msg)
    sys.exit(1)

def main():
    if not GUARD_DOC.exists():
        fail("Missing guard doc: doctrine/baseline_canon/guards/legacy_baseline_guard.md")

    if not SPINES.exists():
        fail("Missing canonical authoring file: doctrine/baseline_canon/baseline_spines.v1.json")

    if not RUNTIME.exists():
        fail("Missing runtime build artifact: doctrine/baseline_canon/baseline_canon_runtime.v1.json (run build_baseline_canon_runtime.py)")

    # Lightweight repo scan in psa_engine only (fast, deterministic)
    # Exclude refactoring/analysis tools that legitimately work with legacy data
    EXCLUDED_PATHS = [
        "analyze_legacy_baseline_for_refactor.py",
        "consolidate_spines.py",
        "build_baseline_canon_runtime.py",
        "verify_baseline_canon_guards.py",
    ]
    hits = []
    for p in ENGINE_DIR.rglob("*.py"):
        if any(excluded in str(p) for excluded in EXCLUDED_PATHS):
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in FORBIDDEN_MARKERS:
            if m in txt and "baseline_canon" not in str(p):
                hits.append((str(p), m))

    if hits:
        print("[FAIL] Forbidden legacy baseline markers detected:")
        for path, marker in hits[:50]:
            print(" -", path, "=>", marker)
        sys.exit(1)

    print("[OK] Guard verification passed.")
    print("[OK] Canon files present:")
    print(" -", SPINES)
    print(" -", RUNTIME)
    print(" -", GUARD_DOC)

if __name__ == "__main__":
    main()
