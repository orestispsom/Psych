#!/usr/bin/env python3
"""Extract structured question content from the Greek 100 Crucial Questions PDF.

This is a deterministic source-import helper. It keeps PDF extraction out of the
runtime application and emits reviewable JSON or JavaScript data.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


SECTION_HEADINGS = (
    "ΑΞΟΝΑΣ ΑΝΑΚΛΗΣΗΣ",
    "ΠΡΟΤΥΠΗ ΠΡΟΦΟΡΙΚΗ ΑΠΑΝΤΗΣΗ",
    "ΒΑΣΙΚΑ ΣΗΜΕΙΑ ΓΙΑ ΤΙΣ ΕΞΕΤΑΣΕΙΣ",
    "ΣΥΧΝΕΣ ΠΑΓΙΔΕΣ / ΠΑΓΙΔΕΣ ΕΞΕΤΑΣΤΗ",
    "ΑΠΑΝΤΗΣΗ ΕΞΕΤΑΣΕΩΝ VS ΣΥΓΧΡΟΝΗ ΠΡΑΚΤΙΚΗ",
)

SUPPLEMENTAL_HEADINGS = (
    "ΕΡΩΤΗΣΗ ΕΞΕΤΑΣΤΗ",
    "ΕΡΏΤΗΣΗ ΕΞΕΤΑΣΤΉ",
    "ΕΡΩΤΗΣΕΙΣ ΕΞΕΤΑΣΤΗ",
    "ΙΣΤΟΡΙΚΟ ΣΤΟΙΧΕΙΟ ΕΞΕΤΑΣΕΩΝ",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--format", choices=("json", "js"), default="json")
    return parser.parse_args()


def clean_page_text(text: str) -> str:
    cleaned: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"\d+", line):
            continue
        if "100 ΚΑΙΡΙΕΣ ΕΡΩΤΗΣΕΙΣ ΣΤΗΝ ΨΥΧΙΑΤΡΙΚΗ" in line and re.search(r"Q\d+", line):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def join_wrapped(lines: list[str]) -> str:
    text = " ".join(part.strip() for part in lines if part.strip())
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def numbered_items(text: str) -> list[str]:
    items: list[list[str]] = []
    for line in text.splitlines():
        match = re.match(r"^\d+\s+(.+)$", line)
        if match:
            items.append([match.group(1)])
        elif items:
            items[-1].append(line)
    return [join_wrapped(item) for item in items]


def bullet_items(text: str) -> list[str]:
    items: list[list[str]] = []
    for line in text.splitlines():
        if line.startswith("•"):
            items.append([line[1:].strip()])
        elif items:
            items[-1].append(line)
    return [join_wrapped(item) for item in items]


def practice_blocks(text: str) -> list[str]:
    bullets = bullet_items(text)
    return bullets if bullets else paragraphize(text, target_chars=420)


def paragraphize(text: str, target_chars: int = 520) -> list[str]:
    prose = join_wrapped(text.splitlines())
    sentences = re.split(r"(?<=[.!;;])\s+(?=[Α-ΩA-ZΆΈΉΊΌΎΏ0-9«])", prose)
    paragraphs: list[str] = []
    current: list[str] = []
    current_length = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and current_length + len(sentence) > target_chars:
            paragraphs.append(" ".join(current))
            current = []
            current_length = 0
        current.append(sentence)
        current_length += len(sentence) + 1
    if current:
        paragraphs.append(" ".join(current))
    return paragraphs


def slice_section(block: str, heading: str) -> str:
    start = block.find(heading)
    if start < 0:
        return ""
    start += len(heading)
    ends = [block.find(candidate, start) for candidate in SECTION_HEADINGS if candidate != heading]
    ends.extend(block.find(candidate, start) for candidate in SUPPLEMENTAL_HEADINGS)
    valid_ends = [end for end in ends if end >= 0]
    end = min(valid_ends) if valid_ends else len(block)
    return block[start:end].strip()


def extract_questions(pdf_path: Path) -> list[dict[str, object]]:
    with pdfplumber.open(pdf_path) as pdf:
        corpus = "\n".join(clean_page_text(page.extract_text() or "") for page in pdf.pages[4:])

    starts = list(re.finditer(r"(?m)^ΕΡΩΤΗΣΗ (\d+)\s*$", corpus))
    questions: list[dict[str, object]] = []
    for index, match in enumerate(starts):
        number = int(match.group(1))
        block_end = starts[index + 1].start() if index + 1 < len(starts) else len(corpus)
        block = corpus[match.end():block_end].strip()
        axis_start = block.find("ΑΞΟΝΑΣ ΑΝΑΚΛΗΣΗΣ")
        title = join_wrapped(block[:axis_start].splitlines()) if axis_start >= 0 else ""
        axis_text = slice_section(block, "ΑΞΟΝΑΣ ΑΝΑΚΛΗΣΗΣ")
        answer_text = slice_section(block, "ΠΡΟΤΥΠΗ ΠΡΟΦΟΡΙΚΗ ΑΠΑΝΤΗΣΗ")
        key_points_text = slice_section(block, "ΒΑΣΙΚΑ ΣΗΜΕΙΑ ΓΙΑ ΤΙΣ ΕΞΕΤΑΣΕΙΣ")
        traps_text = slice_section(block, "ΣΥΧΝΕΣ ΠΑΓΙΔΕΣ / ΠΑΓΙΔΕΣ ΕΞΕΤΑΣΤΗ")
        modern_text = slice_section(block, "ΑΠΑΝΤΗΣΗ ΕΞΕΤΑΣΕΩΝ VS ΣΥΓΧΡΟΝΗ ΠΡΑΚΤΙΚΗ")
        questions.append(
            {
                "id": f"Q{number}",
                "number": number,
                "title": title,
                "recallAxis": numbered_items(axis_text),
                "modelAnswer": paragraphize(answer_text),
                "keyPoints": bullet_items(key_points_text),
                "examTraps": bullet_items(traps_text),
                "examVsPractice": practice_blocks(modern_text),
            }
        )
    return questions


def serialize(questions: list[dict[str, object]], output_format: str) -> str:
    payload = json.dumps(questions, ensure_ascii=False, indent=2)
    if output_format == "js":
        return (
            "// Generated from The 100 Crucial Questions in Psychiatry (Greek complete A4).\n"
            "// Regenerate with tools/extract-crucial-questions.py; do not edit by hand.\n"
            f"const crucialQuestions = {payload};\n\n"
            "export default crucialQuestions;\n"
        )
    return payload + "\n"


def main() -> None:
    args = parse_args()
    questions = extract_questions(args.pdf)
    if len(questions) != 100:
        raise SystemExit(f"Expected 100 questions, extracted {len(questions)}")
    rendered = serialize(questions, args.format)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
