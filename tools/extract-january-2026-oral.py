"""Convert the January 2026 oral-exam notes into the oral bank schema."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from docx import Document


def extract_questions(docx_path: Path) -> list[dict]:
    paragraphs = [paragraph.text.strip() for paragraph in Document(docx_path).paragraphs]
    questions: list[dict] = []
    current: dict | None = None

    for paragraph in paragraphs:
        if not paragraph:
            continue
        heading = re.match(r"^(\d+)\.\s+(.+)$", paragraph)
        if heading:
            if current:
                current["answer"] = "\n\n".join(current.pop("answer_parts"))
                questions.append(current)
            number = int(heading.group(1))
            current = {
                "id": f"jan2026_{number:02d}",
                "num": number,
                "text": heading.group(2),
                "answer_parts": [],
                "role": "anchor",
                "source": "Προφορικές εξετάσεις Ιανουαρίου 2026",
            }
        elif current:
            current["answer_parts"].append(paragraph)

    if current:
        current["answer"] = "\n\n".join(current.pop("answer_parts"))
        questions.append(current)

    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    questions = extract_questions(args.docx)
    if len(questions) != 31 or any(not item["answer"] for item in questions):
        raise ValueError("Expected 31 numbered oral questions with non-empty supplied answers")

    group = {
        "id": "january-2026",
        "label": "Ιαν 2026",
        "title": "ΠΡΟΦΟΡΙΚΑ ΙΑΝΟΥΑΡΙΟΥ 2026",
        "color": "#2563eb",
        "topics": [
            {
                "id": "jan2026",
                "letter": "",
                "title": "Θέματα εξεταστικής Ιανουαρίου 2026",
                "description": "Αυθεντικά θέματα και συνοπτικές απαντήσεις από την εξεταστική Ιανουαρίου 2026.",
                "subtopics": None,
                "questions": questions,
            }
        ],
    }
    serialized = json.dumps(group, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(serialized + "\n", encoding="utf-8")
    else:
        print(serialized)


if __name__ == "__main__":
    main()
