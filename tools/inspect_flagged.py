# -*- coding: utf-8 -*-
import json, re, sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open("src/data/oral.js", "r", encoding="utf-8") as f:
    text = f.read()

m = re.search(r'const oralData\s*=\s*(\[[\s\S]*?\]);\s*export', text)
data = json.loads(m.group(1))

for gravity in data:
    for topic in gravity.get("topics", []):
        subtopics = topic.get("subtopics", [])
        questions = []
        if subtopics:
            for s in subtopics:
                questions.extend(s.get("questions", []))
        else:
            questions.extend(topic.get("questions", []))
            
        for q in questions:
            ans = q["answer"]
            for pat in ["•", "- ", "1.", "2.", "*", "1) ", "2) "]:
                if pat in ans:
                    print(f"[{q['id']}] matched '{pat}':\n{ans}\n{'-'*60}")
                    break
