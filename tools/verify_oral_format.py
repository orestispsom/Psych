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

total = 0
single_p = 0
multi_p = 0
invalid_chars = 0

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
            total += 1
            ans = q["answer"]
            paragraphs = [p for p in ans.split("\n\n") if p.strip()]
            if len(paragraphs) > 1:
                multi_p += 1
            else:
                single_p += 1
                print(f"Single paragraph in [{q['id']}] {q['text'][:50]}")
            if "•" in ans or "\n- " in ans or "\n* " in ans:
                invalid_chars += 1
                print(f"Invalid bullet in [{q['id']}]")

print(f"\nFinal Verification Summary:")
print(f"Total questions: {total}")
print(f"Multi-paragraph count: {multi_p}")
print(f"Single-paragraph count: {single_p}")
print(f"Invalid bullet count: {invalid_chars}")
if single_p == 0 and invalid_chars == 0 and total == 129:
    print("ALL 129 ORAL ANSWERS PERFECTLY VERIFIED!")
