# -*- coding: utf-8 -*-
import fitz  # PyMuPDF
import re
import json
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

pdf_path = r"C:\Users\orest\OneDrive\Υπολογιστής\Ψυχιατρικη\MCQ\MCQ\Crash Course Psychiatry 5th Edition.pdf"
doc = fitz.open(pdf_path)
print(f"Total pages in PDF: {len(doc)}")

# Let's search for "HINTS AND TIPS", "CLINICAL TIP", "EMERGENCY", "Table", "Box", "CRASH SCENE", etc.
boxes_found = []

for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    
    # Search for Hints & Tips, Clinical Tips, Key Points, Summary boxes
    # Also look for Box X.X or Table X.X
    lines = text.splitlines()
    for i, line in enumerate(lines):
        line_clean = line.strip()
        if re.search(r'^(HINTS?\s+AND\s+TIPS?|CLINICAL\s+TIP|EMERGENCY|KEY\s+POINTS?|BOX\s+\d+|TABLE\s+\d+)', line_clean, re.I):
            context = "\n".join(lines[max(0, i-1):min(len(lines), i+8)])
            boxes_found.append({
                "page": page_num + 1,
                "type": line_clean,
                "snippet": context
            })

print(f"Total potential box markers found: {len(boxes_found)}")
for b in boxes_found[:25]:
    print(f"[Page {b['page']}] {b['type']}")
    print(f"   {b['snippet'][:120]}...\n")
