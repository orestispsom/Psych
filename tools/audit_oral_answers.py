# -*- coding: utf-8 -*-
import json
import re
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("src/data/oral.js", "r", encoding="utf-8") as f:
    text = f.read()

m = re.search(r'const oralData\s*=\s*(\[[\s\S]*?\]);\s*export', text)
if not m:
    print("Could not find oralData array")
    sys.exit(1)

data = json.loads(m.group(1))

total_questions = 0
bullets_found = 0
single_paragraph_count = 0
multi_paragraph_count = 0

for g_idx, gravity in enumerate(data):
    for t_idx, topic in enumerate(gravity.get("topics", [])):
        subtopics = topic.get("subtopics", [])
        if subtopics:
            for s_idx, subtopic in enumerate(subtopics):
                for q_idx, q in enumerate(subtopic.get("questions", [])):
                    total_questions += 1
                    ans = q.get("answer", "")
                    paragraphs = [p for p in ans.split("\n\n") if p.strip()]
                    if len(paragraphs) > 1:
                        multi_paragraph_count += 1
                    else:
                        single_paragraph_count += 1
                    if "•" in ans or "- " in ans or "1." in ans or "2." in ans or "*" in ans:
                        bullets_found += 1
                        print(f"Bullet in [{q['id']}] {q['text'][:40]}")
        else:
            for q_idx, q in enumerate(topic.get("questions", [])):
                total_questions += 1
                ans = q.get("answer", "")
                paragraphs = [p for p in ans.split("\n\n") if p.strip()]
                if len(paragraphs) > 1:
                    multi_paragraph_count += 1
                else:
                    single_paragraph_count += 1
                if "•" in ans or "- " in ans or "1." in ans or "2." in ans or "*" in ans:
                    bullets_found += 1
                    print(f"Bullet in [{q['id']}] {q['text'][:40]}")

print(f"\nAudit Results:")
print(f"Total questions: {total_questions}")
print(f"Multi-paragraph answers: {multi_paragraph_count}")
print(f"Single-paragraph answers: {single_paragraph_count}")
print(f"Answers containing bullets/numbered lists: {bullets_found}")
