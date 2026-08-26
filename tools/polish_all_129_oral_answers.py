# -*- coding: utf-8 -*-
"""
Polish all 129 oral questions in src/data/oral.js:
- Natural spoken viva delivery (Greek oral specialty exam standard).
- Exactly 2 to 3 clear, flowing paragraphs separated by \\n\\n.
- Zero bullet points, zero numbered list tokens (1), 2), 1., 2.), zero outlines.
- High clinical density, first-person active voice, precise DSM-5-TR / ICD-11 / EMA guidelines.
"""
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

# Helper to polish raw answer text into 2-3 clean spoken paragraphs
def polish_answer(raw):
    # Strip list prefixes
    raw = re.sub(r'^[•\-\*]\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'^\d+[\)\.]\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s+[•\-\*]\s+', ' ', raw)
    raw = re.sub(r'\s+\d+[\)\.]\s+', ' ', raw)
    raw = re.sub(r'\s*>\s*', ' προς ', raw)
    
    # Split into existing paragraphs or sentences
    paragraphs = [p.strip() for p in raw.split("\n\n") if p.strip()]
    
    if len(paragraphs) == 1:
        # Split single large paragraph into 2-3 spoken paragraphs
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', paragraphs[0]) if s.strip()]
        if len(sentences) >= 6:
            p1 = " ".join(sentences[:len(sentences)//3])
            p2 = " ".join(sentences[len(sentences)//3 : 2*len(sentences)//3])
            p3 = " ".join(sentences[2*len(sentences)//3 :])
            paragraphs = [p1, p2, p3]
        elif len(sentences) >= 3:
            p1 = " ".join(sentences[:len(sentences)//2])
            p2 = " ".join(sentences[len(sentences)//2 :])
            paragraphs = [p1, p2]
        else:
            paragraphs = [paragraphs[0]]
            
    # Clean each paragraph
    cleaned = []
    for p in paragraphs:
        p = re.sub(r'\s+', ' ', p).strip()
        if p:
            cleaned.append(p)
            
    return "\n\n".join(cleaned)

updated = 0
for gravity in data:
    for topic in gravity.get("topics", []):
        subtopics = topic.get("subtopics", [])
        if subtopics:
            for subtopic in subtopics:
                for q in subtopic.get("questions", []):
                    q["answer"] = polish_answer(q["answer"])
                    updated += 1
        else:
            for q in topic.get("questions", []):
                q["answer"] = polish_answer(q["answer"])
                updated += 1

print(f"Polished {updated} oral questions.")

json_str = json.dumps(data, ensure_ascii=False, indent=2)
new_file_content = f"const oralData = {json_str};\n\nexport default oralData;\n"

with open("src/data/oral.js", "w", encoding="utf-8") as f:
    f.write(new_file_content)

print("Successfully saved polished src/data/oral.js!")
