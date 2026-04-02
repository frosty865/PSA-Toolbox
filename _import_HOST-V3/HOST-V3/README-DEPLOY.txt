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
   - HOST V3.html or HOST-V3.html (same app)

Keep this structure (example):
  HOST-V3\
    index.html
    HOST V3.html
    HOST-V3.html
    Assets\
    LocalData\
    src\
    Data\          (optional)

No installation is required. The app runs offline; Google Fonts in styles.css load
when a network is available (layout still works without them).

If the UI looks like plain text on white, you are almost certainly missing the
Assets folder or opened the file before extracting.
