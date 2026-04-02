"""
Vercel serverless function: POST JSON payload (same as export/final), returns DOCX bytes.
Requires project root to be asset-dependency-tool so apps/reporter and ADA/ are available.
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import tempfile
import shutil

# Reporter and template paths. Vercel cwd is project base.
# When Root Directory = asset-dependency-tool: apps/reporter and ADA/ are siblings of api/.
# When Root Directory = apps/web: copy reporter and ADA into apps/web at build time (see docs).
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BASE = os.path.dirname(_SCRIPT_DIR) if os.path.basename(_SCRIPT_DIR) == "api" else _SCRIPT_DIR
# Prefer apps/reporter (monorepo root), else reporter/ (copied into apps/web)
_REPORTER_PATH = os.path.join(_BASE, "apps", "reporter") if os.path.isdir(os.path.join(_BASE, "apps", "reporter")) else os.path.join(_BASE, "reporter")
if os.path.isdir(_REPORTER_PATH) and _REPORTER_PATH not in sys.path:
    sys.path.insert(0, _REPORTER_PATH)
# Template: ADA/report template.docx under project base
TEMPLATE_PATH = os.path.join(_BASE, "ADA", "report template.docx")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self.send_error(400, "Missing body")
            return
        try:
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if not os.path.isfile(TEMPLATE_PATH):
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f"Template not found: {TEMPLATE_PATH}".encode("utf-8"))
            return

        work_dir = tempfile.mkdtemp(prefix="report_")
        try:
            from main import run_from_payload
            docx_bytes = run_from_payload(data, work_dir, TEMPLATE_PATH)
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            self.send_header("Content-Disposition", 'attachment; filename="Infrastructure-Dependency-Tool-Report.docx"')
            self.end_headers()
            self.wfile.write(docx_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def do_GET(self):
        self.send_response(405)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Use POST with JSON payload")
