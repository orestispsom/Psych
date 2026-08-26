import re

with open("src/data/oral.js", "r", encoding="utf-8") as f:
    text = f.read()

ids = re.findall(r'id:\s*"([^"]+)",\s*num:', text)
print(f"Total questions in oral.js: {len(ids)}")
print(ids)
