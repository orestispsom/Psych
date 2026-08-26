# -*- coding: utf-8 -*-
"""
Build src/data/sos.js cleanly and deterministically.
"""
import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Import new data
from rework_sos_subfunction1_numbers import new_sos_numbers
from rework_sos_subfunction3_critical import critical_topics
from rework_sos_subfunction4_differentials import differentials

def generate_export_array(name, items):
    lines = [f"export const {name} = ["]
    for item in items:
        id_val = json.dumps(item["id"], ensure_ascii=False)
        title_val = json.dumps(item["title"], ensure_ascii=False)
        answer_val = json.dumps(item["answer"], ensure_ascii=False)
        lines.append("  {")
        lines.append(f"    id: {id_val},")
        lines.append(f"    title: {title_val},")
        lines.append(f"    answer: {answer_val},")
        lines.append("  },")
    lines.append("];")
    return "\n".join(lines)

sos_numbers_code = generate_export_array("sosNumbers", new_sos_numbers)
sos_critical_code = generate_export_array("sosCriticalTopics", critical_topics)
sos_diff_code = generate_export_array("sosDifferentialDiagnosis", differentials)

file_content = f"""{sos_numbers_code}

{sos_critical_code}

{sos_diff_code}

export default {{
  sosNumbers,
  sosCriticalTopics,
  sosDifferentialDiagnosis,
}};
"""

output_path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "sos.js")
with open(output_path, "w", encoding="utf-8") as f:
    f.write(file_content)

print(f"Generated {output_path} successfully with:")
print(f"  - sosNumbers: {len(new_sos_numbers)} items")
print(f"  - sosCriticalTopics: {len(critical_topics)} items")
print(f"  - sosDifferentialDiagnosis: {len(differentials)} items")
