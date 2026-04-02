Infrastructure Dependency Tool — field static bundle (browser-only)
=====================================================================

End-user steps (non-technical): see FIELD_PERSONNEL_INSTRUCTIONS.txt in this folder.

PRIMARY USE: OPEN FROM DISK (file://)
--------------------------------------
This build is post-processed so you can open it without Python, Node, or a web server:

  • Double-click index.html at the root of this folder, OR
  • Use File → Open in your browser and choose apps/web/out/index.html (same folder as this file).

All scripts and links use relative paths so the browser can load chunks from the same folder tree.

If something stays blank:
  • Ensure JavaScript is enabled.
  • Use a current Chromium or Firefox build (Edge/Chrome/Firefox).
  • Do not move only part of the folder — keep the whole `out` tree (including `_next`).

OPTIONAL: HTTPS hosting
-----------------------
You may still host this tree on an internal HTTPS static site; root-absolute paths are rewritten to
relative ones, which also work when served from the site root.

Enterprise proxies
-------------------
Strict Content-Security-Policy without script-src 'unsafe-inline' can block Next.js hydration (blank page).

Subpath hosting
---------------
If you must serve under https://host/myapp/ rebuild the field bundle with FIELD_STATIC_BASE_PATH=/myapp
(see monorepo README). Opening from disk (file://) normally uses the default build with no base path.
