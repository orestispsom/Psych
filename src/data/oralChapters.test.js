import { describe, it, expect } from 'vitest';
import previous from './oral';
import clinical from './oralCore';
import crucial from './crucialQuestionsContent';
import { buildOralBank, chapterForQuestion, oralChapters } from './oralChapters';
import { oralRetirements, oralConsolidatedPoints } from './oralRetirements';
import related from './oralPreviousQuestionSources';
import { getSearchIndex } from '../lib/searchIndex';
import { parseAppPath, pathForOralPage } from '../appRoutes';

describe('Greek oral chapter organization', () => {
  it('keeps all former oral bookmarks usable in the unified workspace', () => {
    ['/oral', '/oral/past', '/oral/past/questions', '/oral/past/table', '/oral/crucial', '/oral/crucial/question', '/oral/simulator']
      .forEach(path => expect(parseAppPath(path)).toMatchObject({ valid: true, screen: 'oral' }));
  });
  it('routes chapter and question pages without losing the oral screen', () => {
    expect(pathForOralPage(3, 'Q1')).toBe('/oral/chapters/3/questions/Q1');
    expect(parseAppPath(pathForOralPage(3))).toMatchObject({ valid: true, screen: 'oral', oralChapter: 3, oralQuestion: null });
    expect(parseAppPath(pathForOralPage(3, 'Q1'))).toMatchObject({ valid: true, screen: 'oral', oralChapter: 3, oralQuestion: 'Q1' });
    expect(parseAppPath('/oral/chapters/27')).toMatchObject({ valid: false });
  });
  it('places every active question exactly once and preserves archived source records', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const history = previous.flatMap(g => g.topics.flatMap(t => (t.subtopics || [t]).flatMap(s => s.questions || [])));
    expect(Object.keys(oralRetirements)).toHaveLength(35);
    expect(bank).toHaveLength(491);
    expect(bank).toHaveLength(history.length + clinical.length + crucial.length - Object.keys(oralRetirements).length);
    expect(new Set(bank.map(q => q.id)).size).toBe(bank.length);
    expect(bank.filter(q => !oralChapters.some(ch => ch.id === q.chapter))).toEqual([]);
    history.filter(q => !oralRetirements[q.id]).forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
    clinical.filter(q => !oralRetirements[q.id]).forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
    crucial.forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
  });
  it('redirects every retirement to a live question without chains and retains consolidated details', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const sourceIds = new Set([...previous.flatMap(g => g.topics.flatMap(t => (t.subtopics || [t]).flatMap(s => s.questions || []))), ...clinical, ...crucial].map(q => q.id));
    Object.entries(oralRetirements).forEach(([id, replacement]) => {
      expect(sourceIds.has(id)).toBe(true);
      expect(bank.some(q => q.id === id)).toBe(false);
      expect(oralRetirements[replacement]).toBeUndefined();
      expect(bank.find(q => q.id === replacement)).toBeDefined();
    });
    Object.entries(oralConsolidatedPoints).forEach(([id, points]) => {
      expect(bank.find(q => q.id === id)?.additionalAnswer).toEqual(points);
    });
    expect(bank.find(q => q.id === '2Ag1').additionalAnswer.join(' ')).toContain('μεγαλύτερη αντικαταθλιπτική αποτελεσματικότητα');
  });
  it('uses the same active bank in global search, excluding all retired cards', async () => {
    const oral = (await getSearchIndex()).filter(item => item.scope === 'oral');
    expect(oral).toHaveLength(491);
    expect(oral.some(item => oralRetirements[item.state.oralQuestionId])).toBe(false);
    expect(oral.find(item => item.state.oralQuestionId === '2Ag1').body).toContain('SERT');
  });
  it('keeps corrected references aligned with catatonia, cannabis, somatic symptoms and research methods', () => {
    expect(related['3D2']).toEqual(['Q10']);
    expect(related['3D17']).toEqual(['Q41']);
    expect(related['3D23']).toEqual(['Q71', 'Q73']);
    expect(related['3D27']).toEqual(['Q35']);
    expect(related['1Ag4']).not.toContain('Q100');
    ['5A4', '5A8', '5A9', '5A10', '5A11', '5A12', '4B5'].forEach(id => expect(related[id]).toEqual([]));
  });
  it('distinguishes symptom chapters, ethics, research, suicide and biological therapies', () => {
    expect(oralChapters).toHaveLength(26);
    expect(chapterForQuestion('3D3')).toBe(12);
    expect(chapterForQuestion('Q61')).toBe(17);
    expect(chapterForQuestion('Q6')).toBe(18);
    expect(chapterForQuestion('4B5')).toBe(4);
    expect(chapterForQuestion('5A11')).toBe(6);
    expect(chapterForQuestion('1Ab6')).toBe(21);
    expect(chapterForQuestion('Q89')).toBe(25);
    expect(chapterForQuestion('Q100')).toBe(8);
  });
});
