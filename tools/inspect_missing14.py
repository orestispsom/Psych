# -*- coding: utf-8 -*-
import json, sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("tools/oxford_raw.json", "r", encoding="utf-8") as f:
    raw_boxes = {b["id"]: b for b in json.load(f)}

missing_ids = [
    "oxford-3.4", "oxford-3.5", "oxford-3.6", "oxford-3.7", "oxford-3.8",
    "oxford-3.9", "oxford-3.10", "oxford-3.11", "oxford-3.12",
    "oxford-4.4", "oxford-4.5", "oxford-5.4", "oxford-5.5", "oxford-5.6"
]

for m_id in missing_ids:
    print("=" * 60)
    print(json.dumps(raw_boxes[m_id], ensure_ascii=False, indent=2))
