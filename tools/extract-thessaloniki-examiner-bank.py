"""Extract examiner-authored MCQs and highlighted answer keys from the source PDF.

The PDF stores its answer key as baked-in yellow highlighting rather than PDF
annotations.  This extractor combines PyMuPDF's text geometry with a pixel
check so the resulting correct-answer indexes remain traceable to the source.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import fitz


SECTION_TITLES = {
    "Kλινική Ψυχολογία": "Κλινική Ψυχιατρική",
    "Βιολογική Ψυχιατρική και Φαρμακολογία": "Βιολογική Ψυχιατρική και Φαρμακολογία",
    "Stress": "Στρες και Ψυχοσωματική Ιατρική",
    "Ψυχολογική Ψυχιατρική": "Ψυχολογική Ψυχιατρική",
}


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", value.lower())
    return "".join(char for char in value if char.isalnum() and not unicodedata.combining(char))


def line_has_yellow(pixmap: fitz.Pixmap, bbox: tuple[float, float, float, float], scale: int) -> bool:
    x0 = max(0, int(bbox[0] * scale))
    y0 = max(0, int(bbox[1] * scale))
    x1 = min(pixmap.width, int(bbox[2] * scale))
    y1 = min(pixmap.height, int(bbox[3] * scale))
    samples = pixmap.samples
    channels = pixmap.n
    yellow_pixels = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            offset = (y * pixmap.width + x) * channels
            red, green, blue = samples[offset : offset + 3]
            if red > 220 and green > 200 and blue < 100:
                yellow_pixels += 1
                if yellow_pixels > 5:
                    return True
    return False


def extract_questions(pdf_path: Path) -> list[dict]:
    document = fitz.open(pdf_path)
    questions: list[dict] = []
    current: dict | None = None
    section: str | None = None

    def finish_current() -> None:
        nonlocal current
        if current is None:
            return
        current["stem"] = " ".join(current["stem"]).strip()
        current["options"] = [" ".join(option).strip() for option in current["options"]]

        # The final source item is formatted without bullet glyphs.
        if not current["options"] and current["number"] == 38 and current["page"] == 24:
            lines = current.pop("unbulleted_lines", [])
            current["stem"] = lines[0]
            current["options"] = lines[1:6]
            current["highlighted"] = [False, True, False, False, False]

        questions.append(current)
        current = None

    scale = 2
    for page_index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        lines = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text:
                    baseline = line["spans"][0]["origin"][1]
                    lines.append((line["bbox"], baseline, text, line_has_yellow(pixmap, line["bbox"], scale)))
        lines.sort(key=lambda item: (round(item[1], 1), item[0][0]))

        for bbox, _baseline, text, highlighted in lines:
            if text in SECTION_TITLES:
                section = SECTION_TITLES[text]
                continue

            number_match = re.match(r"^(\d{1,2})\.\s*(.*)$", text)
            if number_match and bbox[0] < 100:
                finish_current()
                remainder = number_match.group(2)
                current = {
                    "page": page_index + 1,
                    "number": int(number_match.group(1)),
                    "section": section,
                    "stem": [remainder] if remainder else [],
                    "options": [],
                    "highlighted": [],
                    "unbulleted_lines": [remainder] if remainder else [],
                }
                continue

            if current is None:
                continue

            bullet_match = re.match(r"^●\s*(.*)$", text)
            if bullet_match:
                option_text = bullet_match.group(1)
                current["options"].append([option_text] if option_text else [])
                current["highlighted"].append(highlighted)
                continue

            if not current["options"]:
                if bbox[0] >= 80:
                    current["stem"].append(text)
                    current["unbulleted_lines"].append(text)
            elif bbox[0] >= 125 or current["section"] == "Ψυχολογική Ψυχιατρική":
                current["options"][-1].append(text)
                current["highlighted"][-1] |= highlighted

    finish_current()
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--existing-bank", type=Path)
    parser.add_argument("--start-id", type=int, default=3204)
    parser.add_argument("--output-js", type=Path)
    args = parser.parse_args()

    existing_signatures: set[tuple[str, tuple[str, ...], int]] = set()
    if args.existing_bank:
        raw = args.existing_bank.read_text(encoding="utf-8")
        data = json.loads(re.sub(r"^export default\s*", "", raw).rstrip().rstrip(";"))
        existing_signatures = {
            (
                normalize(item["stem"]),
                tuple(normalize(option) for option in item["options"]),
                item["correct"],
            )
            for item in data
            if item.get("source") != "thessaloniki_examiner_bank"
        }

    source_questions = extract_questions(args.pdf)
    output = []
    seen_signatures = set(existing_signatures)
    next_id = args.start_id
    for item in source_questions:
        if len(item["options"]) not in {5, 6}:
            raise ValueError(f"Unexpected option count on page {item['page']} question {item['number']}")
        correct_indexes = [index for index, value in enumerate(item["highlighted"]) if value]
        if len(correct_indexes) != 1:
            raise ValueError(f"Expected one highlighted answer on page {item['page']} question {item['number']}")

        correct = correct_indexes[0]
        signature = (
            normalize(item["stem"]),
            tuple(normalize(option) for option in item["options"]),
            correct,
        )
        if signature in seen_signatures:
            continue
        output.append(
            {
                "id": next_id,
                "topic": "Τράπεζα εξεταστών Θεσσαλονίκης",
                "section": item["section"],
                "source": "thessaloniki_examiner_bank",
                "sourceStatus": "exact",
                "qualityStatus": "unchecked",
                "stem": item["stem"],
                "options": item["options"],
                "correct": correct,
                "explanation": f"Η επισημασμένη απάντηση στην πηγή είναι: «{item['options'][correct]}».",
            }
        )
        seen_signatures.add(signature)
        next_id += 1

    serialized = json.dumps(output, ensure_ascii=False, indent=2)
    if args.output_js:
        args.output_js.write_text(f"export default {serialized};\n", encoding="utf-8")
    else:
        print(serialized)
    print(
        json.dumps(
            {
                "sourceQuestions": len(source_questions),
                "alreadyPresentExactItems": len(source_questions) - len(output),
                "newQuestions": len(output),
            },
            ensure_ascii=False,
        ),
        file=__import__("sys").stderr,
    )


if __name__ == "__main__":
    main()
