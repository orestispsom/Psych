import json
import re
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("src/data/oxfordBoxes.js", "r", encoding="utf-8") as f:
    text = f.read()

print("Length of file (characters):", len(text))
print("First 400 characters:\n", text[:400])

# Match oxfordBoxes
m = re.search(r'export const oxfordBoxes\s*=\s*(\[[\s\S]*?\]);', text)
if m:
    boxes = json.loads(m.group(1))
    print(f"Total boxes: {len(boxes)}")
    for i, b in enumerate(boxes):
        print(f"{i+1}. id={b.get('id')}, title={b.get('title')}, topic={b.get('topic')}")
else:
    print("Could not parse as JSON array directly, inspecting structure...")
