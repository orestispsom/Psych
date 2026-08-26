# -*- coding: utf-8 -*-
import fitz
import re
import json
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

pdf_path = r"C:\Users\orest\OneDrive\Υπολογιστής\Ψυχιατρικη\MCQ\MCQ\Crash Course Psychiatry 5th Edition.pdf"
doc = fitz.open(pdf_path)

all_boxes = []

for page_idx in range(len(doc)):
    page_num = page_idx + 1
    page = doc[page_idx]
    text = page.get_text()
    
    # Let's find headings like "TABLE X.X", "BOX X.X", "KEY POINTS", "EMERGENCY"
    # Find all table/box headers
    matches = list(re.finditer(r'(TABLE|BOX)\s+(\d+\.\d+)\s*[:\—\–\-]?\s*([^\n\r]+)', text, re.I))
    for m in matches:
        b_type, b_num, b_title = m.groups()
        b_title = b_title.strip()
        # skip cross references like "see Table 1.1"
        start = m.start()
        prefix = text[max(0, start-15):start]
        if re.search(r'(see|in|from|shows|summarizes|directs)\s+$', prefix, re.I):
            continue
        
        # Grab text of this table/box
        body = text[m.end():m.end()+2500]
        # clean up body up to next table/heading
        all_boxes.append({
            "type": b_type.capitalize(),
            "number": b_num,
            "title": b_title,
            "page": page_num,
            "raw_snippet": body[:400]
        })

print(f"Total valid Table & Box declarations found: {len(all_boxes)}")
for i, b in enumerate(all_boxes):
    print(f"{i+1:2d}. [{b['type']} {b['number']}] pg {b['page']}: {b['title']}")
