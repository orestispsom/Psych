# -*- coding: utf-8 -*-
import fitz
import re
import json
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

pdf_path = r"C:\Users\orest\OneDrive\Υπολογιστής\Ψυχιατρικη\MCQ\MCQ\Crash Course Psychiatry 5th Edition.pdf"
doc = fitz.open(pdf_path)

# Let's map chapter boundaries from TOC
toc = doc.get_toc()
chapters = []
for level, title, page in toc:
    if level == 2 and re.match(r'^\d+\s+', title):
        m = re.match(r'^(\d+)\s+(.+)', title)
        chapters.append({
            "num": int(m.group(1)),
            "title": m.group(2),
            "start_page": page
        })

for i in range(len(chapters)):
    if i < len(chapters) - 1:
        chapters[i]["end_page"] = chapters[i+1]["start_page"] - 1
    else:
        chapters[i]["end_page"] = 270

print(f"Total chapters identified: {len(chapters)}")

# Extract all Tables and Boxes with their text
extracted_items = []

for ch in chapters:
    ch_num = ch["num"]
    ch_title = ch["title"]
    start_p = ch["start_page"] - 1
    end_p = ch["end_page"] - 1
    
    for p_idx in range(start_p, end_p + 1):
        page = doc[p_idx]
        text = page.get_text()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        
        # Look for Table X.X or Box X.X headers
        for l_idx, line in enumerate(lines):
            # Check Table
            m_tab = re.match(r'^Table\s*(\d+\.\d+)\s*(.*)', line, re.I)
            if m_tab:
                tab_num, tab_title = m_tab.groups()
                # If title is empty or very short, take next line
                if len(tab_title) < 3 and l_idx + 1 < len(lines):
                    tab_title = lines[l_idx + 1]
                
                # grab lines following
                body_lines = lines[l_idx+1:l_idx+35]
                extracted_items.append({
                    "kind": "table",
                    "chapter": ch_num,
                    "chapter_title": ch_title,
                    "number": tab_num,
                    "title": tab_title.strip(),
                    "page": p_idx + 1,
                    "body": body_lines
                })
            
            # Check Box
            m_box = re.match(r'^Box\s*(\d+\.\d+)\s*(.*)', line, re.I)
            if m_box:
                box_num, box_title = m_box.groups()
                if len(box_title) < 3 and l_idx + 1 < len(lines):
                    box_title = lines[l_idx + 1]
                body_lines = lines[l_idx+1:l_idx+35]
                extracted_items.append({
                    "kind": "box",
                    "chapter": ch_num,
                    "chapter_title": ch_title,
                    "number": box_num,
                    "title": box_title.strip(),
                    "page": p_idx + 1,
                    "body": body_lines
                })

print(f"Total extracted items: {len(extracted_items)}")
# Deduplicate by number
unique_items = {}
for it in extracted_items:
    num = it["number"]
    if num not in unique_items:
        unique_items[num] = it

print(f"Unique tables & boxes count: {len(unique_items)}")
for k, v in list(unique_items.items())[:35]:
    print(f"[{v['kind'].upper()} {v['number']}] (Ch {v['chapter']} pg {v['page']}): {v['title']}")
