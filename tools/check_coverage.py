# -*- coding: utf-8 -*-
import json, sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("tools/oxford_raw.json", "r", encoding="utf-8") as f:
    raw_boxes = json.load(f)
raw_ids = [b["id"] for b in raw_boxes]
raw_map = {b["id"]: b for b in raw_boxes}

batch_boxes = []
for i in range(1, 6):
    with open(f"tools/oxford_batch{i}.json", "r", encoding="utf-8") as f:
        b = json.load(f)
        batch_boxes.extend(b)

batch_ids = set(b["id"] for b in batch_boxes)
batch_map = {b["id"]: b for b in batch_boxes}

print(f"Total raw boxes: {len(raw_ids)}")
print(f"Total translated batch boxes: {len(batch_boxes)}")

missing = [b_id for b_id in raw_ids if b_id not in batch_ids]
print(f"Missing box count: {len(missing)}")
for m_id in missing:
    b = raw_map[m_id]
    print(f"  Missing: [{b['id']}] Ch {b['chapter']} Box {b['boxNumber']}: \"{b['title']}\"")
