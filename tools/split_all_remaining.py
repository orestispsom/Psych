# -*- coding: utf-8 -*-
import json
import re
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("src/data/oral.js", "r", encoding="utf-8") as f:
    text = f.read()

m = re.search(r'const oralData\s*=\s*(\[[\s\S]*?\]);\s*export', text)
data = json.loads(m.group(1))

for g in data:
    for t in g.get("topics", []):
        subtopics = t.get("subtopics", [])
        qs = []
        if subtopics:
            for s in subtopics:
                qs.extend(s.get("questions", []))
        else:
            qs.extend(t.get("questions", []))
            
        for q in qs:
            ans = q["answer"]
            paragraphs = [p.strip() for p in ans.split("\n\n") if p.strip()]
            if len(paragraphs) == 1:
                text_block = paragraphs[0]
                # Split at semicolons or periods
                # If only 2 sentences, split at the first sentence
                sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text_block) if s.strip()]
                if len(sentences) >= 2:
                    mid = len(sentences) // 2
                    p1 = " ".join(sentences[:mid]).strip()
                    p2 = " ".join(sentences[mid:]).strip()
                    q["answer"] = f"{p1}\n\n{p2}"
                else:
                    # Single very long sentence: split at first semicolon or colon
                    parts = re.split(r'(?<=[;:])\s+', text_block, maxsplit=1)
                    if len(parts) == 2:
                        q["answer"] = f"{parts[0].strip()}\n\n{parts[1].strip()}"

json_str = json.dumps(data, ensure_ascii=False, indent=2)
new_file_content = f"const oralData = {json_str};\n\nexport default oralData;\n"

with open("src/data/oral.js", "w", encoding="utf-8") as f:
    f.write(new_file_content)

print("Split remaining single paragraphs successfully!")
