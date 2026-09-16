import { describe, expect, it } from "vitest";

import importedMatchingSets from "./mcqMatchingImported.js";
import translatedMatchingSets from "./mcqMatchingGreek.js";

const INTENTIONAL_KEY_CORRECTIONS = new Map([
  // EMQ 42 is visibly line-shifted in the extracted source. The reviewed Greek
  // bank restores the missing psychotic-depression, poor-intake, and mild-
  // depression cases as 42_03, 42_04, and 42_05 respectively.
  ["crash_course_match_42_03", ["F"]],
  ["crash_course_match_42_04", ["A"]],
  ["crash_course_match_42_05", ["C"]],

  // The imported extraction maps this item to I (chlorpromazine), while its
  // own explanation identifies carbamazepine/valproate. Valproate is absent
  // from the extracted option list, so G (carbamazepine) is the coherent key.
  ["crash_course_match_50_01", ["G"]],
]);

const RECONSTRUCTED_ITEM_IDS = new Map([
  ["crash_course_emq_42", [
    "crash_course_match_42_01",
    "crash_course_match_42_02",
    "crash_course_match_42_03",
    "crash_course_match_42_04",
    "crash_course_match_42_05",
  ]],
]);

const GREEK_TEXT = /[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/;
const EXTRACTION_ARTIFACTS = [
  "afastpulse",
  "compulsivedisorder",
  "General feedback:",
  "Chapter 3 Psychological therapy",
  "themedication",
  "ersonality disorder",
  "chizophrenia",
  "regabalin",
  "ripiprazole",
  "orticosteroids",
  "razodone",
];

function flattenLearnerText(set) {
  return [
    set.title,
    set.instructions,
    ...set.choices.map(choice => choice.label),
    ...set.items.flatMap(item => [item.prompt, item.explanation]),
  ].filter(Boolean).join("\n");
}

describe("Greek matching-question bank", () => {
  it("covers every imported EMQ set and preserves item identity except documented reconstruction", () => {
    expect(translatedMatchingSets.map(set => set.id)).toEqual(
      importedMatchingSets.map(set => set.id),
    );

    for (let index = 0; index < importedMatchingSets.length; index += 1) {
      const sourceSet = importedMatchingSets[index];
      const translatedSet = translatedMatchingSets[index];
      const expectedItemIds = RECONSTRUCTED_ITEM_IDS.get(sourceSet.id)
        ?? sourceSet.items.map(item => item.id);

      expect(translatedSet.items.map(item => item.id)).toEqual(expectedItemIds);
    }
  });

  it("preserves answer keys except for explicitly documented source-extraction corrections", () => {
    const sourceItems = new Map(
      importedMatchingSets.flatMap(set => set.items).map(item => [item.id, item]),
    );

    for (const set of translatedMatchingSets) {
      const choiceIds = new Set(set.choices.map(choice => choice.id));
      expect(choiceIds.size).toBe(set.choices.length);

      for (const item of set.items) {
        const sourceItem = sourceItems.get(item.id);
        const expected = INTENTIONAL_KEY_CORRECTIONS.get(item.id) ?? sourceItem?.correct;

        expect(expected, `Missing source or documented correction for ${item.id}`).toBeTruthy();
        expect(item.correct).toEqual(expected);

        for (const answer of item.correct) {
          expect(choiceIds.has(answer)).toBe(true);
        }
      }
    }
  });

  it("contains complete learner-facing Greek text and no known extraction debris", () => {
    const seenItemIds = new Set();

    for (const set of translatedMatchingSets) {
      expect(set.title?.trim()).toBeTruthy();
      expect(set.instructions?.trim()).toBeTruthy();
      expect(set.title).toMatch(GREEK_TEXT);
      expect(set.instructions).toMatch(GREEK_TEXT);

      for (const item of set.items) {
        expect(seenItemIds.has(item.id)).toBe(false);
        seenItemIds.add(item.id);

        expect(item.prompt?.trim()).toBeTruthy();
        expect(item.explanation?.trim()).toBeTruthy();
        expect(item.prompt).toMatch(GREEK_TEXT);
        expect(item.explanation).toMatch(GREEK_TEXT);
      }

      const learnerText = flattenLearnerText(set);
      for (const artifact of EXTRACTION_ARTIFACTS) {
        expect(learnerText).not.toContain(artifact);
      }
    }
  });
});
