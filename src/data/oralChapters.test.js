import { describe, it, expect } from 'vitest';
import previous from './oral';
import clinical from './oralCore';
import crucial from './crucialQuestionsContent';
import { buildOralBank, chapterForQuestion, oralChapters } from './oralChapters';
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
  it('places every existing question exactly once, retaining its identity and content', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const history = previous.flatMap(g => g.topics.flatMap(t => (t.subtopics || [t]).flatMap(s => s.questions || [])));
    expect(bank).toHaveLength(history.length + clinical.length + crucial.length);
    expect(new Set(bank.map(q => q.id)).size).toBe(bank.length);
    expect(bank.filter(q => !oralChapters.some(ch => ch.id === q.chapter))).toEqual([]);
    history.forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
    clinical.forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
    crucial.forEach(q => expect(bank.find(item => item.id === q.id)).toMatchObject(q));
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
