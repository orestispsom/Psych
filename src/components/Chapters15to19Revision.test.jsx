import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BoardRevisionNotes from './BoardRevisionNotes';
import OralWorkspace from './OralWorkspace';
import ch13 from '../data/oralChapter13Notes';
import ch14 from '../data/oralChapter14Notes';
import ch15 from '../data/oralChapter15Notes';
import ch16 from '../data/oralChapter16Notes';
import ch17to19 from '../data/oralChapters17to19Notes';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import crucial from '../data/crucialQuestionsContent';
import { buildOralBank } from '../data/oralChapters';
import { getSearchIndex } from '../lib/searchIndex';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const additions = { ...ch15, ...ch16, ...ch17to19 };
const bank = buildOralBank(previous, clinical, crucial);
const chunk = bank.filter(q => q.chapter >= 15 && q.chapter <= 19);

describe('Chapters 15–19 board revision', () => {
  it('covers all 39 live questions, preserves empty chapter 18 and earlier revisions', () => {
    expect([15, 16, 17, 18, 19].map(ch => chunk.filter(q => q.chapter === ch).length)).toEqual([17, 18, 1, 0, 3]);
    expect(Object.keys(additions).sort()).toEqual(chunk.map(q => q.id).sort());
    for (const q of chunk) expect(q.studyNotes).toBe(additions[q.id]);
    for (const q of bank.filter(q => q.chapter === 13)) expect(q.studyNotes).toBe(ch13[q.id]);
    for (const q of bank.filter(q => q.chapter === 14)) expect(q.studyNotes).toBe(ch14[q.id]);
    expect(bank.filter(q => q.chapter < 13 || q.chapter > 24).every(q => !q.studyNotes)).toBe(true);
    for (const q of crucial.filter(q => chunk.some(x => x.id === q.id))) expect(bank.find(x => x.id === q.id)).toMatchObject(q);
    for (const q of clinical.filter(q => chunk.some(x => x.id === q.id))) expect(bank.find(x => x.id === q.id).answer).toBe(q.answer);
  });

  it('renders every card with complete emphasis, focused sections and usable citations', () => {
    const view = render(<BoardRevisionNotes notes={chunk[0].studyNotes} />);
    for (const q of chunk) {
      view.rerender(<BoardRevisionNotes notes={q.studyNotes} />);
      expect(q.studyNotes.sections.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.studyNotes.sections.every(s => s.items.length > 0 && s.items.some(x => x.includes('**'))), q.id).toBe(true);
      expect(view.container.querySelectorAll('strong').length, q.id).toBeGreaterThan(2);
      expect(view.container.textContent, q.id).not.toContain('**');
      expect(view.container.textContent, q.id).not.toContain('Πρότυπη προφορική απάντηση');
      expect(q.studyNotes.sources.length, q.id).toBeGreaterThan(0);
      expect([...view.container.querySelectorAll('a')].every(a => a.href.startsWith('https://')), q.id).toBe(true);
    }
  });

  it('shows notes for past, clinical and crucial cards, and retains completion/navigation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderAnswer = vi.fn(() => <p>Old answer</p>);
    const renderCrucial = vi.fn(() => <p>Old model answer</p>);
    const mastered = vi.fn();
    const user = userEvent.setup();
    const props = { oralProgress: { mastered: {} }, profileId: 'ch15to19-test', onQuestionMastered: mastered, renderAnswer, renderCrucial };
    for (const [chapter, id] of [[15, '5B1'], [16, 'oral_core_025'], [17, 'Q61'], [19, 'Q52']]) {
      const view = render(<MemoryRouter initialEntries={[`/oral/chapters/${chapter}/questions/${id}`]}><OralWorkspace {...props} /></MemoryRouter>);
      const article = await screen.findByRole('article');
      expect(await within(article).findByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
      await user.click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
      expect(mastered).toHaveBeenLastCalledWith(id, true);
      if (id === '5B1') {
        await user.click(within(article).getByRole('button', { name: /Επόμενη/ }));
        expect(await screen.findByRole('heading', { name: /Ποια τα χαρακτηριστικά της αντικοινωνικής/ })).toBeInTheDocument();
      }
      view.unmount();
    }
    expect(renderAnswer).not.toHaveBeenCalled();
    expect(renderCrucial).not.toHaveBeenCalled();
  });

  it('makes expanded criteria and practical detail searchable across the chunk', async () => {
    const index = await getSearchIndex();
    for (const [id, chapter, term] of [
      ['Q68', 15, 'αναγκαστικότητα'],
      ['oral_core_025', 16, 'πριν από τα 12'],
      ['Q61', 17, 'Διαγνωστική επισκίαση'],
      ['Q52', 19, 'άρθρου 95'],
    ]) {
      const result = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === id);
      expect(result.body).toContain(term);
      expect(result.body).not.toContain('**');
      expect(result.path).toBe(`/oral/chapters/${chapter}/questions/${id}`);
    }
  });
});
