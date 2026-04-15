HOST â€” static deployment (HOST-V3 folder)
============================================

REQUIRED: Extract this entire ZIP first. Do not open HTML from inside the archive â€”
browsers cannot load Assets/, LocalData/, and src/ from a ZIP path, so the UI will
look unstyled and broken.

Steps
-----
1. Extract the ZIP so you get a folder named: HOST-V3
2. Open either:
   - index.html   (recommended launcher), or
   - HOST V3.html (canonical app file)

Keep this structure (example):
  HOST-V3\
    index.html
    HOST V3.html
    Assets\
    LocalData\
    src\
    Data\          (optional)

No installation is required. The app runs offline; Google Fonts in styles.css load
when a network is available (layout still works without them).

If the UI looks like plain text on white, you are almost certainly missing the
Assets folder or opened the file before extracting.

Print / PDF: The printable report loads Assets/report template.docx in the browser
(via Assets/js/mammoth.browser.min.js) and merges it with the generated report HTML.
Serve the folder over http(s) (e.g. localhost) so the .docx can be fetched; opening
HOST V3.html as file:// may block fetch and fall back to the built-in HTML header only.

Remote Word (ADA-style, recommended): Use the same Python report-service deployed on
Railway (or similar) as the ADA / Infrastructure Dependency Analysis tool — POST /render
with JSON { "generic_report": { ... } }, implemented by report-service/app.py. On the
Railway service, set env HOTEL_TEMPLATE_PATH to the absolute path of HOST’s Word
template inside the container (or ship tools/hotel-analysis/Assets/report template.docx
in the deploy bundle). Enable CORS on that Flask app for your HOST web origin so the
browser can call POST /render (see report-service CORS in the reporter repo).

In HOST, set the service base URL before load, for example:
  window.HOST_REPORT_SERVICE_URL = 'https://<your-railway-app>.up.railway.app';
or the full endpoint:
  window.HOST_REPORT_RENDER_URL = 'https://<your-railway-app>.up.railway.app/render';
(meta: host-report-service-url or host-report-render-url). Print sends current report
content as generic_report (template_key hotel-analysis), downloads the returned .docx,
and you print from Word. If the request fails, HOST falls back to the in-browser Mammoth
print path above.
