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

  it('presents every source-linked answer as informational notes', () => {
    const bank = new Map(buildOralBank(previous, clinical, crucial).map(q => [q.id, q]));
    const destinations = new Set(review.requirements.flatMap(x => x.destinations));
    for (const id of destinations) {
      const notes = bank.get(id).studyNotes;
      expect(notes?.sections.length, id).toBeGreaterThan(0);
      expect(notes.hideSources, id).toBe(true);
    }
    const displayed = id => JSON.stringify(bank.get(id).studyNotes);
    expect(displayed('Q3')).toContain('μεφλοκίνη');
    expect(displayed('Q10')).toContain('ραβδομυόλυσης');
    expect(displayed('Q10')).toContain('48–72 ώρες');
    expect(displayed('Q99')).toContain('Σεξουαλική δυσλειτουργία με φυσιολογική προλακτίνη');
  });
});
