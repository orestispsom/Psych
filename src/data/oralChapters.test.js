import { describe, it, expect } from 'vitest';
import secondPass from '../../docs/oral-duplicate-second-pass.json';
import consolidations from '../../docs/oral-duplicate-consolidation.json';
import chapterMoves from '../../docs/oral-chapter-audit-moves.json';
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
    expect(Object.keys(oralRetirements)).toHaveLength(175);
    expect(bank).toHaveLength(351);
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
  it('consolidates Chapter 1 while retaining clinical distinctions and unique treatment details', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    expect(bank.filter(q => q.chapter === 1)).toHaveLength(12);
    ['Q10', 'oral_core_017_fu02', 'oral_core_035_fu03', 'oral_core_035_fu05', 'oral_core_035_fu06'].forEach(id => expect(bank.some(q => q.id === id)).toBe(true));
    const catatonia = bank.find(q => q.id === 'Q10');
    expect(catatonia.modelAnswer.join(' ')).toContain('Τα 12 χαρακτηριστικά σημεία');
    expect(catatonia.additionalAnswer.join(' ')).toContain('ραβδομυόλυσης');
    expect(catatonia.additionalAnswer.join(' ')).toContain('νόμιμη διαδικασία συναίνεσης');
    expect(bank.find(q => q.id === 'oral_core_017_fu02').additionalAnswer.join(' ')).toContain('εσωτερική ανάγκη για συνεχή κίνηση');
  });
  it('keeps every audited consolidation destination live and its source archived', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    for (const item of consolidations) {
      const replacement = oralRetirements[item.retained] || item.retained;
      expect(oralRetirements[item.retired]).toBe(replacement);
      expect(bank.some(q => q.id === item.retired)).toBe(false);
      expect(bank.find(q => q.id === replacement)?.chapter).toBe(item.chapter);
    }
    expect(bank.find(q => q.id === 'Q67').additionalAnswer.join(' ')).toContain('0,5–2 Hz');
    expect(bank.find(q => q.id === '5A9').additionalAnswer.join(' ')).toContain('1/0,10 = 10');
    expect(bank.find(q => q.id === 'oral_core_007_fu02').additionalAnswer.join(' ')).toContain('24ωρο');
  });
  it('consolidates cross-chapter classification and the four repeated assessment follow-ups', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    expect(bank.filter(q => q.chapter === 3).map(q => q.id)).toEqual(['Q1', 'Q3', 'Q6', 'Q7']);
    expect(bank.filter(q => q.chapter === 2)).toHaveLength(0);
    expect(oralRetirements['1Aa3']).toBe('Q12');
    expect(bank.find(q => q.id === 'Q12').additionalAnswer.join(' ')).toContain('όχι κριτήρια ICD-11');
    for (const item of secondPass) {
      expect(oralRetirements[item.retired]).toBe(item.retained);
      expect(bank.some(q => q.id === item.retired)).toBe(false);
      expect(bank.find(q => q.id === item.retained)?.chapter).toBe(item.toChapter);
    }
  });
  it('uses the same active bank in global search, excluding all retired cards', async () => {
    const oral = (await getSearchIndex()).filter(item => item.scope === 'oral');
    expect(oral).toHaveLength(351);
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
  it('applies every audited move exactly once without changing answer content or its parent scenario', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    expect(chapterMoves).toHaveLength(17);
    for (const move of chapterMoves.filter(move => !oralRetirements[move.id])) {
      const matches = bank.filter(q => q.id === move.id);
      expect(matches).toHaveLength(1);
      expect(matches[0].chapter).toBe(move.to);
      expect(matches[0].text).toBe(move.question);
    }
    expect(chapterForQuestion('oral_core_016')).toBe(3);
    expect(chapterForQuestion('oral_core_016_fu04')).toBe(4);
    expect(chapterForQuestion('oral_core_001')).toBe(11);
    expect(chapterForQuestion('oral_core_001_fu07')).toBe(25);
    expect(chapterForQuestion('oral_core_009')).toBe(8);
    expect(chapterForQuestion('oral_core_009_fu01')).toBe(1);
    expect(chapterForQuestion('Q14')).toBe(5);
    expect(chapterForQuestion('jan2026_04')).toBe(11);
  });
  it('distinguishes symptom chapters, ethics, research, suicide and biological therapies', () => {
    expect(oralChapters).toHaveLength(26);
    expect(chapterForQuestion('jan2026_16')).toBe(11);
    expect(chapterForQuestion('3D1')).toBe(1);
    expect(chapterForQuestion('3D2')).toBe(1);
    expect(chapterForQuestion('3D3')).toBe(12);
    expect(chapterForQuestion('Q61')).toBe(17);
    expect(chapterForQuestion('Q6')).toBe(3);
    expect(chapterForQuestion('4B5')).toBe(4);
    expect(chapterForQuestion('5A11')).toBe(6);
    expect(chapterForQuestion('1Ab6')).toBe(21);
    expect(chapterForQuestion('Q89')).toBe(25);
    expect(chapterForQuestion('Q100')).toBe(8);
  });
});
