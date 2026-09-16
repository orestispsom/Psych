import { describe, expect, it } from "vitest";

import translatedMatchingSets from "./mcqMatchingGreek.js";
import {
  boardMatchingExpansions,
  expandMatchingSetsWithBoardItems,
} from "./mcqMatchingBoardExpansion.js";

const GREEK_TEXT = /[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/;

describe("high-value board matching expansions", () => {
  it("only adds stems for answer choices that were unused in the translated source set", () => {
    const sourceById = new Map(translatedMatchingSets.map(set => [set.id, set]));
    const allNewIds = new Set();

    for (const [setId, additions] of Object.entries(boardMatchingExpansions)) {
      const sourceSet = sourceById.get(setId);
      expect(sourceSet, `Missing target set ${setId}`).toBeTruthy();

      const choiceIds = new Set(sourceSet.choices.map(choice => choice.id));
      const previouslyUsedAnswers = new Set(sourceSet.items.flatMap(item => item.correct));
      const newlyUsedAnswers = new Set();

      for (const item of additions) {
        expect(allNewIds.has(item.id), `Duplicate expansion id ${item.id}`).toBe(false);
        allNewIds.add(item.id);

        expect(sourceSet.items.some(sourceItem => sourceItem.id === item.id)).toBe(false);
        expect(item.correct).toHaveLength(1);

        const [answer] = item.correct;
        expect(choiceIds.has(answer), `${item.id} references missing answer ${answer}`).toBe(true);
        expect(previouslyUsedAnswers.has(answer), `${item.id} reuses an already-tested answer ${answer}`).toBe(false);
        expect(newlyUsedAnswers.has(answer), `${item.id} duplicates a new answer ${answer} within ${setId}`).toBe(false);
        newlyUsedAnswers.add(answer);

        expect(item.prompt?.trim()).toBeTruthy();
        expect(item.explanation?.trim()).toBeTruthy();
        expect(item.prompt).toMatch(GREEK_TEXT);
        expect(item.explanation).toMatch(GREEK_TEXT);
        expect(item.origin).toBe("board-curated-high-value");
        expect(item.qualityStatus).toBe("reviewed");
      }
    }
  });

  it("preserves every source item and appends the reviewed additions", () => {
    const expanded = expandMatchingSetsWithBoardItems(translatedMatchingSets);

    expect(expanded.map(set => set.id)).toEqual(translatedMatchingSets.map(set => set.id));

    for (let index = 0; index < translatedMatchingSets.length; index += 1) {
      const sourceSet = translatedMatchingSets[index];
      const expandedSet = expanded[index];
      const additions = boardMatchingExpansions[sourceSet.id] || [];

      expect(expandedSet.items.slice(0, sourceSet.items.length)).toEqual(sourceSet.items);
      expect(expandedSet.items.slice(sourceSet.items.length)).toEqual(additions);
    }
  });

  it("keeps the expansion deliberately selective", () => {
    const additions = Object.values(boardMatchingExpansions).flat();

    expect(Object.keys(boardMatchingExpansions)).toHaveLength(10);
    expect(additions).toHaveLength(24);
  });
});
