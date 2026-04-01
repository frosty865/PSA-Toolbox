#!/usr/bin/env python3
"""
Reporter-only performance test: run report generation N times and write metrics.
Loads a fixed JSON fixture, measures wall-clock time per run and average.
Writes data/exports/_perf/<timestamp>/reporter_metrics.json.
No new dependencies; memory metrics skipped if unavailable.
Run from repo root: python apps/reporter/perf_reporter.py [N]
"""
import io
import json
import os
import sys
import time
from pathlib import Path

REPORTER_DIR = Path(__file__).resolve().parent
REPO_ROOT = REPORTER_DIR.parent.parent
PERF_ROOT = REPO_ROOT / "data" / "exports" / "_perf"

# Fixed payload: same shape as dev_smoke minimal + one category with chart
FIXTURE_PAYLOAD = {
    "assessment": {
        "asset": {"asset_name": "Perf Reporter", "visit_date_iso": "", "assessor": "", "location": ""},
        "categories": {
            "ELECTRIC_POWER": {
                "requires_service": True,
                "time_to_impact_hours": 24,
                "loss_fraction_no_backup": 0.5,
                "has_backup_any": True,
                "backup_duration_hours": 48,
                "loss_fraction_with_backup": 0.1,
                "recovery_time_hours": 12,
            },
        },
    },
    "vofc_collection": {"items": []},
}


def main() -> None:
    n_runs = 5
    if len(sys.argv) > 1:
        try:
            n_runs = max(1, int(sys.argv[1]))
        except ValueError:
            pass

    if str(REPORTER_DIR) not in sys.path:
        sys.path.insert(0, str(REPORTER_DIR))

    # Use a dedicated temp work dir for perf (reused across runs to avoid mkdir noise)
    work_dir = REPO_ROOT / "data" / "temp" / "reporter-perf"
    work_dir.mkdir(parents=True, exist_ok=True)
    os.environ["WORK_DIR"] = str(work_dir)

    stdin_content = json.dumps(FIXTURE_PAYLOAD)
    old_stdin = sys.stdin

    times_ms: list[float] = []
    for i in range(n_runs):
        sys.stdin = io.StringIO(stdin_content)
        t0 = time.perf_counter()
        try:
            from main import main as reporter_main
            reporter_main()
        finally:
            sys.stdin = old_stdin
        elapsed_ms = (time.perf_counter() - t0) * 1000
        times_ms.append(elapsed_ms)

    avg_ms = sum(times_ms) / len(times_ms) if times_ms else 0
    timestamp = time.strftime("%Y-%m-%dT%H-%M-%S", time.gmtime())
    out_dir = PERF_ROOT / timestamp
    out_dir.mkdir(parents=True, exist_ok=True)
    metrics = {
        "n_runs": n_runs,
        "times_ms": times_ms,
        "average_ms": round(avg_ms, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    # Optional: memory (skip if unavailable)
    try:
        import resource  # Unix only
        usage = resource.getrusage(resource.RUSAGE_SELF)
        metrics["max_rss_kb"] = getattr(usage, "ru_maxrss", None)
    except (ImportError, AttributeError):
        pass

    out_path = out_dir / "reporter_metrics.json"
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
