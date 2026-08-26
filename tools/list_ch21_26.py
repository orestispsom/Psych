# -*- coding: utf-8 -*-
import json, sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("tools/oxford_raw.json", "r", encoding="utf-8") as f:
    boxes = json.load(f)

for b in boxes:
    if 21 <= b['chapter'] <= 26:
        print(f"[{b['id']}] Ch {b['chapter']} Box {b['boxNumber']} (p. {b.get('page')}, g. {b.get('gravity')}): {b['title']}")
