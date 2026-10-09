# Oral answer alignment correction

The workspace appended entire related crucial-question chapters as answers to narrower past-exam questions. This affected all 184 active past-exam pages with source mappings. A related topic is not an answer to the selected prompt. The rendering change in PR30 made this especially visible by removing the disclosures and displaying all linked model responses openly.

The workspace now renders only the selected question's own answer and approved consolidated details. The selected crucial question still displays its own complete model response. Related topics appear as separately titled navigation links; following one opens that topic's own question page. No clinical answers, IDs, chapter placements, completion data or retirement redirects were changed.

Reviewed all 196 historical reference mappings (184 active, 12 archived) against the current 100 question titles. Corrected 37 mappings, including semantic ID drift: Q97 is now a bipolar mixed-features/rapid-cycling question, so research-method prompts must not point to it. Empty reference lists are intentional when no sufficiently relevant topic exists in the 100-question collection. Checked the five historical chapter-1 prompts against their direct answers; those direct answers address their own prompts. This checks association and rendering, not medical or legal factual accuracy across all answer text.

Notable corrections:
- 3D2 (volition, psychomotor examination and catatonia): Q1/Q9/Q45 → Q10.
- 1Ag4 (cognition in schizophrenia): removed Q100 (resistant OCD); retained Q16/Q17.
- 3D17 (cannabis): Q43 (benzodiazepines) → Q41.
- 3D23 (sexual dysfunction/gender dysphoria): eating-disorder topics → Q71/Q73.
- 3D27 (somatic symptoms/illness anxiety): apathy/ADHD topics → Q35.
- 5A4 and 5A8–5A12 (research methods/statistics): removed unrelated bipolar/hyperprolactinaemia topics.
- 4B5 (confidentiality): removed Q98 (severe/psychotic depression).

All original direct answer texts remain intact. This fixes the mismatched extended-answer presentation; it does not claim that every answer has been independently verified against current clinical sources.
