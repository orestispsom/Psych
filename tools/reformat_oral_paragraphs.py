# -*- coding: utf-8 -*-
"""
Reformat all 129 oral questions in src/data/oral.js:
1. Ensure all answers are concise, single model oral answers.
2. Ensure answers are organized in 2-3 spoken paragraphs with \\n\\n.
3. Completely eliminate bullet points (•, -, *), numbered lists (1., 2., 1), 2)), and headings.
4. Maintain authoritative, first-person clinical delivery.
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

def clean_and_paragraph(ans, text_title=""):
    # Remove bullet points and numbered list markers
    # e.g., "1) ", "2) ", "1. ", "• ", "- ", "* "
    ans = re.sub(r'^[•\-\*]\s*', '', ans, flags=re.MULTILINE)
    ans = re.sub(r'^\d+[\)\.]\s*', '', ans, flags=re.MULTILINE)
    ans = re.sub(r'\s+[•\-\*]\s+', ' ', ans)
    ans = re.sub(r'\s+\d+[\)\.]\s+', ' ', ans)
    
    # If the answer is already divided into paragraphs by \n\n, clean each paragraph
    paragraphs = [p.strip() for p in ans.split("\n\n") if p.strip()]
    
    # If it's a single block, split into 2-3 logical spoken paragraphs by sentence boundaries
    if len(paragraphs) == 1:
        sentences = re.split(r'(?<=[.!?])\s+', paragraphs[0])
        if len(sentences) >= 4:
            mid = len(sentences) // 2
            p1 = " ".join(sentences[:mid]).strip()
            p2 = " ".join(sentences[mid:]).strip()
            paragraphs = [p1, p2]
        else:
            paragraphs = [paragraphs[0]]
            
    # Clean up whitespace
    cleaned_paragraphs = []
    for p in paragraphs:
        # replace any remaining bullets/numbers inside
        p = re.sub(r'[•\-\*]\s*', '', p)
        p = re.sub(r'\s+', ' ', p).strip()
        if p:
            cleaned_paragraphs.append(p)
            
    return "\n\n".join(cleaned_paragraphs)

count = 0
for g_idx, gravity in enumerate(data):
    for t_idx, topic in enumerate(gravity.get("topics", [])):
        subtopics = topic.get("subtopics", [])
        if subtopics:
            for s_idx, subtopic in enumerate(subtopics):
                for q_idx, q in enumerate(subtopic.get("questions", [])):
                    q["answer"] = clean_and_paragraph(q["answer"], q.get("text", ""))
                    count += 1
        else:
            for q_idx, q in enumerate(topic.get("questions", [])):
                q["answer"] = clean_and_paragraph(q["answer"], q.get("text", ""))
                count += 1

print(f"Processed {count} questions.")

# Re-serialize oralData
json_str = json.dumps(data, ensure_ascii=False, indent=2)
new_file_content = f"const oralData = {json_str};\n\nexport default oralData;\n"

with open("src/data/oral.js", "w", encoding="utf-8") as f:
    f.write(new_file_content)

print("Saved updated src/data/oral.js!")
