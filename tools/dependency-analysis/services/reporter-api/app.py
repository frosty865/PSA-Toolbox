"""
DOCX Report API — deploy to Railway, Render, or any Python host.
POST /render with JSON payload (same as export/final) → returns DOCX bytes.

Deploy: Railway (recommended), Render, Fly.io, or any Docker host.
Set REPORT_SERVICE_URL in Vercel to enable DOCX export on Beta.
"""
import os

# MUST be set before importing matplotlib.pyplot anywhere
os.environ.setdefault("MPLBACKEND", "Agg")

# Force Agg backend early so reporter chart rendering works headless
try:
    import matplotlib
    matplotlib.use("Agg")
except Exception:
    pass

import json
import sys
import tempfile
import shutil
from pathlib import Path

# Add reporter to path (run from repo root or services/reporter-api)
_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent.parent

# Reporter and template paths
_REPORTER_PATH = _REPO_ROOT / "apps" / "reporter"
_TEMPLATE_PATH = _REPO_ROOT / "ADA" / "report template.docx"

if _REPORTER_PATH.is_dir() and str(_REPORTER_PATH) not in sys.path:
    sys.path.insert(0, str(_REPORTER_PATH))


def _get_template_path() -> Path:
    """Resolve template path; allow override via env."""
    env_path = os.environ.get("TEMPLATE_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)
    return _TEMPLATE_PATH


def create_app():
    import threading
    from flask import Flask, request, Response

    app = Flask(__name__)

    # Render / port scanners often hit /. Respond fast.
    @app.route("/", methods=["GET"])
    def root():
        return "ok", 200

    @app.route("/health", methods=["GET"])
    def health():
        return {"status": "ok"}, 200

    # Preload reporter so first /render doesn't hit import timeout (main.py is large; host may have 5–15s limit).
    @app.route("/warmup", methods=["GET"])
    def warmup():
        try:
            from main import run_from_payload  # noqa: F401
            return {"status": "ok", "reporter": "loaded"}, 200
        except Exception as e:
            return Response(
                json.dumps({"status": "error", "error": str(e)}),
                status=500,
                mimetype="application/json",
            )

    def _preload_reporter():
        try:
            from main import run_from_payload  # noqa: F401
        except Exception:
            pass

    # Start preload in background so first /render is fast (avoids host request timeout on cold start).
    threading.Thread(target=_preload_reporter, daemon=True).start()

    # IMPORTANT: Do NOT load templates, scan files, build charts, or do heavy work at import time.
    # Do heavy work inside the /render handler only.

    @app.route("/render", methods=["POST"])
    def render():
        if not request.content_type or "application/json" not in request.content_type:
            return Response(
                json.dumps({"error": "Content-Type must be application/json"}),
                status=400,
                mimetype="application/json",
            )
        try:
            data = request.get_json(force=True)
        except Exception as e:
            return Response(
                json.dumps({"error": str(e)}),
                status=400,
                mimetype="application/json",
            )

        template_path = _get_template_path()
        if not template_path.is_file():
            return Response(
                json.dumps({"error": f"Template not found: {template_path}"}),
                status=500,
                mimetype="application/json",
            )

        work_dir = tempfile.mkdtemp(prefix="report_")
        try:
            from main import run_from_payload

            docx_bytes = run_from_payload(data, work_dir, str(template_path))
            return Response(
                docx_bytes,
                status=200,
                mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={
                    "Content-Disposition": 'attachment; filename="Asset-Dependency-Assessment-Report.docx"',
                },
            )
        except Exception as e:
            return Response(
                json.dumps({"error": str(e)}),
                status=500,
                mimetype="application/json",
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
