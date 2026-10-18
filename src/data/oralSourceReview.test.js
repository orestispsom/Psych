import { describe, expect, it } from 'vitest';
import review from '../../docs/oral-source-review.json';
import previous from './oral';
import clinical from './oralCore';
import crucial from './crucialQuestionsContent';
import { buildOralBank } from './oralChapters';

describe('oral source review traceability', () => {
  it('accounts for each inventoried source occurrence without candidate-only matches', () => {
    const keys = review.occurrences.map(x => `${x.source}:${x.paragraph}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const source of [1, 2, 3]) {
      expect(review.occurrences.filter(x => x.source === source)).toHaveLength(review.sourceCounts[source]);
    }
    const requirements = new Set(review.requirements.map(x => x.id));
    for (const item of review.occurrences) {
      if (item.requirements) {
        expect(item.requirements.length).toBeGreaterThan(0);
        expect(item.requirements.every(id => requirements.has(id))).toBe(true);
      } else {
        expect(['heading', 'separator', 'answer_subheading', 'unrecoverable_question_mark']).toContain(item.disposition);
      }
    }
    expect(review.occurrences.filter(x => x.disposition === 'unrecoverable_question_mark').map(x => x.paragraph)).toEqual([77, 79, 80, 81]);
  });

  it('keeps every requirement linked to a live destination with displayed answer content', () => {
    const bank = new Map(buildOralBank(previous, clinical, crucial).map(q => [q.id, q]));
    for (const requirement of review.requirements) {
      expect(requirement.destinations.length, requirement.id).toBeGreaterThan(0);
      for (const id of requirement.destinations) {
        const q = bank.get(id);
        expect(q, `${requirement.id}: ${id}`).toBeDefined();
        expect(q.studyNotes?.sections.length || q.answer?.length || q.modelAnswer?.length, id).toBeGreaterThan(0);
      }
    }
    expect(bank.get('exam_dat_scan').chapter).toBe(14);
    expect(bank.get('exam_stabilizers').chapter).toBe(25);
  });
});
