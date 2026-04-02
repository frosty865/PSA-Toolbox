# SAFE Print Export Kit

This kit contains:
- `css/print_patch.css` — drop-in print CSS to fix page boundaries and section/table splits
- `js/export_pdf.js` — html2pdf.js export function (client-side)
- `snippets/hard_break_example.html` — example markup for hard page breaks
- `tools/convert_wkhtmltopdf.sh` — CLI conversion (wkhtmltopdf)
- `tools/convert_weasyprint.py` — Python converter (WeasyPrint)
- `tools/convert_puppeteer.js` — Headless Chrome converter (Puppeteer)
- `tools/package.json` — Node deps for Puppeteer
- `tools/requirements.txt` — Python deps for WeasyPrint

---

## A) Native Print → Save as PDF (Browser)

1. **Link the print patch** in your HTML `<head>` after your main styles:
   ```html
   <link rel="stylesheet" href="css/print_patch.css">
   ```

2. **Insert hard breaks** between major sections where you want new pages:
   ```html
   <div class="hard-break"></div>
   ```

3. **Avoid global “avoid” rules** on whole sections. Keep `page-break-after: avoid` only on headings,
   not on the entire `.section` container.

4. **Print** using the browser’s print dialog. Each major section should now start on a fresh page.

---

## B) Client-side PDF (html2pdf.js)

1. Include `html2pdf.bundle.min.js`:
   ```html
   <script src="https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"></script>
   <script src="js/export_pdf.js"></script>
   ```

2. Add a UI button (hidden by print CSS if desired):
   ```html
   <button onclick="exportPDF()">Export PDF</button>
   ```

3. Add explicit break anchors:
   ```html
   <div class="html2pdf__page-break"></div>
   ```

4. Call **Export PDF**. The script targets `.container` (fallback: `document.body`).

---

## C) Server/CLI Converters (reliable pagination)

> These produce the most consistent results for long, complex reports.

### Option 1 — wkhtmltopdf (WebKit engine)

**Install:** https://wkhtmltopdf.org/downloads.html

**Use:**
```bash
./tools/convert_wkhtmltopdf.sh SAFE_Comprehensive.html SAFE_Comprehensive_wk.pdf
```

### Option 2 — WeasyPrint (CSS Paged Media)

**Install:** `pip install -r tools/requirements.txt`  
> Requires system libs: Cairo, Pango, GDK-PixBuf. See https://weasyprint.org

**Use:**
```bash
python3 tools/convert_weasyprint.py SAFE_Comprehensive.html SAFE_Comprehensive_weasy.pdf
```

### Option 3 — Puppeteer (Headless Chrome)

**Install:** 
```bash
cd tools
npm install
```

**Use:**
```bash
node convert_puppeteer.js ../SAFE_Comprehensive.html ../SAFE_Comprehensive_puppeteer.pdf
```

All three respect the print CSS in `css/print_patch.css` — link it in your HTML before converting.

---

## Integration Notes

- **Tables:** `thead { display: table-header-group; }` ensures header rows repeat.  
- **Headings:** keep with following content to avoid orphaned titles.  
- **Break control:** Use `.hard-break` or `.html2pdf__page-break` before large sections.  
- **Do not** apply `page-break-*: avoid` to entire section containers; reserve for small elements.

If a block still clips, wrap it in `.avoid-break` to force the engine to keep it intact.

---

## Troubleshooting

- **Clipped content** → verify no parent has `overflow: auto|hidden` during print.  
- **Missing icons/images** → ensure absolute URLs or enable `useCORS` (already set for html2pdf).  
- **Wrong paper size** → change `@page { size: Letter; }` to `A4`.  
- **No page breaks with Puppeteer** → add `-print-background` equivalent (enabled in script).