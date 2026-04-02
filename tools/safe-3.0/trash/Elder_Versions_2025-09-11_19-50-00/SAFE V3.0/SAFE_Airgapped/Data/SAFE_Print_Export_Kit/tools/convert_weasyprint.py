#!/usr/bin/env python3
import sys
from weasyprint import HTML, CSS

if len(sys.argv) < 3:
    print("Usage: convert_weasyprint.py input.html output.pdf")
    sys.exit(1)

inp, outp = sys.argv[1], sys.argv[2]
HTML(filename=inp).write_pdf(outp, stylesheets=[CSS('css/print_patch.css')])
print(f"Created {outp}")