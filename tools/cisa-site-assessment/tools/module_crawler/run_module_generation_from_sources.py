#!/usr/bin/env python3
"""
Run Module Generation from Sources

Single runner script that executes the complete pipeline:
1. Comprehension pass
2. Vulnerability extraction
3. Question building (<=12)
"""

import os
import subprocess
import argparse
import sys
import shutil
from pathlib import Path

try:
    import psycopg2
except ImportError:
    psycopg2 = None  # type: ignore[assignment]

# Load .env.local if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, try to manually parse .env.local
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value


def get_python_executable() -> str:
    """Get Python executable path, preferring venv Python."""
    # Try to find python in PATH (will use venv if active)
    python_cmd = shutil.which("python") or shutil.which("python3")
    if python_cmd:
        return python_cmd
    # Fallback to sys.executable if it exists
    if sys.executable and os.path.exists(sys.executable):
        return sys.executable
    # Last resort
    return "python"


def run(cmd: list[str], cwd: Path | None = None, step_name: str = ""):
    """Run a command and exit on failure; on failure print stderr for debugging."""
    print(">>", " ".join(cmd))
    if cwd:
        print(f"   (cwd: {cwd})")
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=3600)
    if p.stdout:
        print(p.stdout, end="" if p.stdout.endswith("\n") else "\n")
    if p.stderr and p.returncode != 0:
        print(p.stderr, file=sys.stderr, end="" if p.stderr.endswith("\n") else "\n")
    if p.returncode != 0:
        if step_name:
            print(f"\n[FAIL] {step_name} exited with code {p.returncode}", file=sys.stderr)
        if p.stderr and not p.stderr.endswith("\n"):
            print(file=sys.stderr)
        raise SystemExit(p.returncode)


def run_check(module_code: str) -> None:
    """Validate env and DB connectivity; print chunk counts for the module (debug)."""
    if psycopg2 is None:
        print("[CHECK] psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    corpus_url = (
        os.environ.get("CORPUS_DATABASE_URL")
        or os.environ.get("CORPUS_DB_URL")
        or os.environ.get("DATABASE_URL_CORPUS")
    )
    runtime_url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
    )
    if not corpus_url:
        print("[CHECK] CORPUS_DATABASE_URL (or CORPUS_DB_URL) not set", file=sys.stderr)
        sys.exit(1)
    if not runtime_url:
        print("[CHECK] RUNTIME_DATABASE_URL (or RUNTIME_DB_URL) not set", file=sys.stderr)
        sys.exit(1)
    try:
        corpus = psycopg2.connect(corpus_url)
        runtime = psycopg2.connect(runtime_url)
    except Exception as e:
        print(f"[CHECK] DB connect failed: {e}", file=sys.stderr)
        sys.exit(1)
    try:
        with corpus.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) FROM public.source_registry
                WHERE (scope_tags->>'module_code') = %s
                """,
                (module_code,),
            )
            sr_count = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(dc.id)
                FROM public.document_chunks dc
                JOIN public.corpus_documents cd ON cd.id = dc.doc_id
                JOIN public.source_registry sr ON sr.id = cd.source_registry_id
                WHERE (sr.scope_tags->>'module_code') = %s
                """,
                (module_code,),
            )
            chunk_count = cur.fetchone()[0]
        with runtime.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM public.assessment_modules WHERE module_code = %s",
                (module_code,),
            )
            module_exists = cur.fetchone() is not None
        print(f"[CHECK] CORPUS: source_registry rows for {module_code!r}: {sr_count}")
        print(f"[CHECK] CORPUS: document_chunks for module: {chunk_count}")
        print(f"[CHECK] RUNTIME: assessment_modules has {module_code!r}: {module_exists}")
        if sr_count == 0:
            print("[CHECK] No source_registry rows with scope_tags->>'module_code' = module_code. Tag sources or ingest.", file=sys.stderr)
        if chunk_count == 0:
            print("[CHECK] No chunks for module. Ingest corpus documents linked to source_registry for this module.", file=sys.stderr)
    finally:
        corpus.close()
        runtime.close()


def main():
    ap = argparse.ArgumentParser(
        description="Run complete module generation pipeline from sources"
    )
    ap.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("--model", required=False, help="Ollama model name (e.g., llama3.1:8b-instruct); required unless --check")
    ap.add_argument("--apply", action="store_true", help="Actually write to database (dry-run by default)")
    ap.add_argument("--max-questions", type=int, default=12, help="Maximum questions to generate (default 12)")
    ap.add_argument("--check", action="store_true", help="Only validate env and DB; print chunk counts (debug) and exit")
    args = ap.parse_args()

    if args.check:
        run_check(args.module_code)
        return

    if not args.model:
        print("Missing --model (required for pipeline). Use --check to only validate env/DB.", file=sys.stderr)
        sys.exit(1)

    # Resolve DB URLs (match project env: CORPUS_DATABASE_URL / RUNTIME_DATABASE_URL)
    corpus_url = (
        os.environ.get("CORPUS_DATABASE_URL")
        or os.environ.get("CORPUS_DB_URL")
        or os.environ.get("DATABASE_URL_CORPUS")
    )
    runtime_url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
    )
    if not corpus_url:
        raise SystemExit(
            "Missing corpus DB URL. Set CORPUS_DATABASE_URL (or CORPUS_DB_URL / DATABASE_URL_CORPUS)."
        )
    if not runtime_url:
        raise SystemExit(
            "Missing runtime DB URL. Set RUNTIME_DATABASE_URL (or RUNTIME_DB_URL / DATABASE_URL_RUNTIME)."
        )
    if not os.environ.get("OLLAMA_HOST"):
        os.environ["OLLAMA_HOST"] = "http://127.0.0.1:11434"

    # Get script directory (psa_rebuild root)
    script_dir = Path(__file__).parent.parent.parent
    apply_flag = ["--apply"] if args.apply else []
    
    # Get Python executable (prefers venv Python if active)
    python_exe = get_python_executable()
    print(f"Using Python: {python_exe}")

    print(f"\n{'='*60}")
    print(f"Module Generation Pipeline: {args.module_code}")
    print(f"Model: {args.model}")
    print(f"Apply: {args.apply}")
    print(f"{'='*60}\n")

    # 1) Comprehension pass (must exist)
    print("\n[STEP 1] Comprehension Pass")
    print("-" * 60)
    run(
        [
            python_exe,
            str(script_dir / "tools" / "module_crawler" / "extract_module_comprehension_from_corpus.py"),
            "--module-code", args.module_code,
            "--model", args.model,
            *apply_flag,
        ],
        cwd=script_dir,
        step_name="Comprehension pass",
    )

    # 2) Vulnerability extraction consuming comprehension
    print("\n[STEP 2] Vulnerability Extraction")
    print("-" * 60)
    run(
        [
            python_exe,
            str(script_dir / "tools" / "module_crawler" / "extract_module_vulnerabilities_from_corpus.py"),
            "--module-code", args.module_code,
            "--model", args.model,
            *apply_flag,
        ],
        cwd=script_dir,
        step_name="Vulnerability extraction",
    )

    # 3) Consolidate/dedupe/select <=12 and write module_questions
    print("\n[STEP 3] Question Building")
    print("-" * 60)
    run(
        [
            python_exe,
            str(script_dir / "tools" / "module_crawler" / "build_module_questions_from_vulns.py"),
            "--module-code", args.module_code,
            "--model", args.model,
            "--max-questions", str(args.max_questions),
            *apply_flag,
        ],
        cwd=script_dir,
        step_name="Question building",
    )

    print("\n" + "=" * 60)
    print("[OK] Module generation complete.")
    print("Next: Wire UI Step 3 to read public.module_questions for the module_code.")
    print("=" * 60)


if __name__ == "__main__":
    main()
