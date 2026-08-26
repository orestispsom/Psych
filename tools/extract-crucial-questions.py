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

import pypdf


SECTION_PATTERNS = {
    "modelAnswer": r"(?m)^ΠΡΟΤΥΠΗ ΠΡΟΦΟΡΙΚΗ ΑΠΑΝΤΗΣΗ\s*$",
    "recallAxis": r"(?m)^ΑΞΟΝΑΣ ΑΝΑΚΛΗΣΗΣ\s*$",
    "keyPoints": r"(?m)^(?:ΒΑΣΙΚΟ ΣΗΜΕΙΟ ΓΙΑ ΤΙΣ ΕΞΕΤΑΣΕΙΣ|ΒΑΣΙΚΌ ΣΗΜΕΊΟ ΓΙΑ ΤΙΣ ΕΞΕΤΆΣΕΙΣ|ΒΑΣΙΚΑ ΣΗΜΕΙΑ ΓΙΑ ΤΙΣ ΕΞΕΤΑΣΕΙΣ|ΒΑΣΙΚΆ ΣΗΜΕΊΑ ΓΙΑ ΤΙΣ ΕΞΕΤΆΣΕΙΣ)\s*$",
    "examiner": r"(?m)^(?:ΕΡΩΤΗΣΕΙΣ ΕΞΕΤΑΣΤΗ|ΕΡΩΤΗΣΗ ΕΞΕΤΑΣΤΗ|ΕΡΏΤΗΣΗ ΕΞΕΤΑΣΤΉ|ΠΙΘΑΝΗ ΕΡΩΤΗΣΗ ΕΞΕΤΑΣΤΗ|ΠΙΘΑΝΉ ΕΡΏΤΗΣΗ ΕΞΕΤΑΣΤΉ)\s*$",
    "practice": r"(?m)^(?:ΑΠΑΝΤΗΣΗ ΕΞΕΤΑΣΕΩΝ ΕΝΑΝΤΙ ΤΡΕΧΟΥΣΑΣ ΠΡΑΚΤΙΚΗΣ|ΑΠΆΝΤΗΣΗ ΕΞΕΤΆΣΕΩΝ ΈΝΑΝΤΙ ΤΡΈΧΟΥΣΑΣ ΠΡΑΚΤΙΚΉΣ|ΑΠΑΝΤΗΣΗ ΕΞΕΤΑΣΕΩΝ VS ΣΥΓΧΡΟΝΗ ΠΡΑΚΤΙΚΗ)\s*$",
}


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
        if "100 ΚΑΙΡΙΕΣ ΕΡΩΤΗΣΕΙΣ ΣΤΗΝ ΨΥΧΙΑΤΡΙΚΗ" in line:
            continue
        if re.match(r"^Q\d+\s+100 ΚΑΙΡΙΕΣ", line):
            continue
        if re.match(r"^100 ΚΑΙΡΙΕΣ ΕΡΩΤΗΣΕΙΣ ΣΤΗΝ ΨΥΧΙΑΤΡΙΚΗ\s+Q\d+", line):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def join_wrapped(lines: list[str]) -> str:
    text = " ".join(part.strip() for part in lines if part.strip())
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def bullet_items(text: str) -> list[str]:
    items: list[list[str]] = []
    for line in text.splitlines():
        if line.startswith("•"):
            items.append([line[1:].strip()])
        elif items:
            items[-1].append(line)
    return [join_wrapped(item) for item in items]


def clean_recall_axis_line(line: str) -> str:
    return re.sub(r"^\d+\s+", "", line.strip()).strip()


def recall_axis_items(text: str) -> list[str]:
    lines = [clean_recall_axis_line(l) for l in text.splitlines() if clean_recall_axis_line(l)]
    if not lines:
        return []
    combined = join_wrapped(lines)
    return [combined]


def paragraphize(text: str, target_chars: int = 520) -> list[str]:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return []
    prose = join_wrapped(lines)
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


def parse_examiner_section(text: str) -> list[dict[str, object]]:
    sub_blocks = re.split(
        r"(?m)^(?:ΕΡΩΤΗΣΕΙΣ ΕΞΕΤΑΣΤΗ|ΕΡΩΤΗΣΗ ΕΞΕΤΑΣΤΗ|ΕΡΏΤΗΣΗ ΕΞΕΤΑΣΤΉ|ΠΙΘΑΝΗ ΕΡΩΤΗΣΗ ΕΞΕΤΑΣΤΗ|ΠΙΘΑΝΉ ΕΡΏΤΗΣΗ ΕΞΕΤΑΣΤΉ)\s*$",
        text,
    )
    results: list[dict[str, object]] = []
    for sb in sub_blocks:
        sb = sb.strip()
        if not sb:
            continue
        lines = sb.splitlines()
        title_lines: list[str] = []
        body_lines: list[str] = []
        found_end_of_q = False
        for line in lines:
            if not found_end_of_q:
                title_lines.append(line)
                if ";" in line or "?" in line or ";" in line or len(title_lines) >= 2:
                    found_end_of_q = True
                elif len(title_lines) == 1 and not (";" in line or "?" in line or ";" in line) and not line.endswith(" και") and not line.endswith(" ή") and not line.endswith(" από"):
                    if any(t in line for t in ["Ιδεατοποίηση", "Υποστηρικτική"]):
                        found_end_of_q = True
            else:
                body_lines.append(line)

        q_title = join_wrapped(title_lines)
        ans_paragraphs = paragraphize("\n".join(body_lines), target_chars=400)
        results.append({
            "question": q_title,
            "answer": ans_paragraphs,
        })
    return results


def extract_questions(pdf_path: Path) -> list[dict[str, object]]:
    reader = pypdf.PdfReader(str(pdf_path))
    pages = [clean_page_text(p.extract_text() or "") for p in reader.pages[5:]]
    corpus = "\n".join(pages)

    starts = list(re.finditer(r"(?m)^ΕΡΩΤΗΣΗ (\d+)\s*$", corpus))
    questions: list[dict[str, object]] = []
    for index, match in enumerate(starts):
        number = int(match.group(1))
        block_end = starts[index + 1].start() if index + 1 < len(starts) else len(corpus)
        block = corpus[match.end():block_end].strip()

        ans_start = block.find("ΠΡΟΤΥΠΗ ΠΡΟΦΟΡΙΚΗ ΑΠΑΝΤΗΣΗ")
        title = join_wrapped(block[:ans_start].splitlines())

        positions: list[tuple[int, int, str]] = []
        for sec_name, pat in SECTION_PATTERNS.items():
            for m in re.finditer(pat, block):
                positions.append((m.start(), m.end(), sec_name))
                break
        positions.sort(key=lambda x: x[0])

        sec_texts: dict[str, str] = {}
        for idx, (p_start, p_end, sec_name) in enumerate(positions):
            next_start = positions[idx + 1][0] if idx + 1 < len(positions) else len(block)
            sec_texts[sec_name] = block[p_end:next_start].strip()

        model_ans_text = sec_texts.get("modelAnswer", "")
        recall_axis_text = sec_texts.get("recallAxis", "")
        key_points_text = sec_texts.get("keyPoints", "")
        examiner_text = sec_texts.get("examiner", "")
        practice_text = sec_texts.get("practice", "")

        recall_axis = recall_axis_items(recall_axis_text) if recall_axis_text else []
        model_answer = paragraphize(model_ans_text)
        key_points = bullet_items(key_points_text) if key_points_text else []
        if not key_points and key_points_text:
            key_points = [join_wrapped(key_points_text.splitlines())]
        examiner_questions = parse_examiner_section(examiner_text) if examiner_text else []
        exam_vs_practice = paragraphize(practice_text) if practice_text else []

        questions.append(
            {
                "id": f"Q{number}",
                "number": number,
                "title": title,
                "recallAxis": recall_axis,
                "modelAnswer": model_answer,
                "keyPoints": key_points,
                "examinerQuestions": examiner_questions,
                "examTraps": [],
                "examVsPractice": exam_vs_practice,
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
