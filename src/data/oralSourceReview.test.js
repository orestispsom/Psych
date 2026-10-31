import { describe, expect, it } from 'vitest';
import review from '../../docs/oral-source-review.json';
import previous from './oral';
import clinical from './oralCore';
import crucial from './crucialQuestionsContent';
import { buildOralBank } from './oralChapters';
import bankClinicalNotes from './oralBankClinicalNotes';
import bankEthicsNotes from './oralBankEthicsNotes';
import bankPharmacologyNotes from './oralBankPharmacologyNotes';
import { oralRetirements } from './oralRetirements';

describe('oral source review traceability', () => {
  it('finishes the 75 bank-only conversions and renders structured notes for the whole bank', () => {
    const additions = [...Object.keys(bankClinicalNotes), ...Object.keys(bankEthicsNotes), ...Object.keys(bankPharmacologyNotes)];
    expect(additions).toHaveLength(75);
    expect(new Set(additions).size).toBe(75);
    const bank = buildOralBank(previous, clinical, crucial);
    expect(bank).toHaveLength(379);
    expect(new Set(bank.map(q => q.id)).size).toBe(379);
    expect(additions.every(id => bank.some(q => q.id === (oralRetirements[id] || id)))).toBe(true);
    for (const q of bank) {
      expect(q.studyNotes?.hideSources, q.id).toBe(true);
      expect(q.studyNotes?.sections.length, q.id).toBeGreaterThan(0);
      for (const section of q.studyNotes.sections) {
        expect(section.title, q.id).toBeTruthy();
        expect(section.paragraphs?.length || section.items?.length || section.table?.rows.length, `${q.id}: ${section.title}`).toBeGreaterThan(0);
        if (section.table) {
          expect(section.table.rows.every(row => row.length === section.table.columns.length), q.id).toBe(true);
        }
      }
    }
    const displayed = id => JSON.stringify(bank.find(q => q.id === id).studyNotes);
    expect(displayed('oral_core_018_fu04')).toContain('πλήρη κλινική ανάρρωση');
    expect(displayed('oral_core_018_fu05')).toContain('αντιπυρετικά δεν');
    expect(displayed('Q83')).toContain('5 ημιζωές');
    expect(displayed('Q8')).toContain('δεν αποτελεί αυτοτελές θεσπισμένο ελληνικό νομικό τεστ');
  });
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
        const q = bank.get(oralRetirements[id] || id);
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
      const notes = bank.get(oralRetirements[id] || id).studyNotes;
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
