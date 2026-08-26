# -*- coding: utf-8 -*-
import fitz
import re
import json
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

pdf_path = r"C:\Users\orest\OneDrive\Υπολογιστής\Ψυχιατρικη\MCQ\MCQ\Crash Course Psychiatry 5th Edition.pdf"
doc = fitz.open(pdf_path)

# Let's inspect the Table of Contents or chapters
toc = doc.get_toc()
print("Table of contents:")
for item in toc[:30]:
    print(item)

# Let's extract all Box X.X, Table X.X, and standalone high-yield callouts
found_items = []

for page_idx in range(len(doc)):
    page_num = page_idx + 1
    page = doc[page_idx]
    text = page.get_text()
    
    # Match BOX X.X
    box_matches = list(re.finditer(r'(BOX\s+(\d+\.\d+)[\s\xa0\—\–\-]+([^\n\r]+))', text, re.I))
    for m in box_matches:
        full_match, box_num, title = m.groups()
        # extract following text up to next section/box
        start_pos = m.start()
        subtext = text[start_pos:start_pos+1500]
        found_items.append({
            "type": "box",
            "page": page_num,
            "boxNumber": box_num,
            "title": title.strip(),
            "raw": subtext
        })
        
    # Match TABLE X.X
    table_matches = list(re.finditer(r'(TABLE\s+(\d+\.\d+)[\s\xa0\—\–\-]+([^\n\r]+))', text, re.I))
    for m in table_matches:
        full_match, table_num, title = m.groups()
        start_pos = m.start()
        subtext = text[start_pos:start_pos+1800]
        found_items.append({
            "type": "table",
            "page": page_num,
            "boxNumber": table_num,
            "title": title.strip(),
            "raw": subtext
        })

print(f"\nTotal Boxes and Tables found: {len(found_items)}")
for it in found_items[:40]:
    print(f"[{it['type'].upper()} {it['boxNumber']}] pg. {it['page']}: {it['title']}")
