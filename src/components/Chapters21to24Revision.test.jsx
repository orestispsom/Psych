import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BoardRevisionNotes from './BoardRevisionNotes';
import OralWorkspace from './OralWorkspace';
import ch21 from '../data/oralChapter21Notes';
import ch22 from '../data/oralChapter22Notes';
import ch24 from '../data/oralChapter24Notes';
import ch20 from '../data/oralChapter20Notes';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import crucial from '../data/crucialQuestionsContent';
import { buildOralBank } from '../data/oralChapters';
import { getSearchIndex } from '../lib/searchIndex';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const bank = buildOralBank(previous, clinical, crucial);
const notes = { ...ch21, ...ch22, ...ch24 };
const chunk = bank.filter(q => q.chapter >= 21 && q.chapter <= 24);

describe('Chapters 21–24 board revision', () => {
  it('covers the prior questions and the recovered psychodynamic topic without inventing chapter 23 content', () => {
    expect([21, 22, 23, 24].map(c => bank.filter(q => q.chapter === c).length)).toEqual([7, 8, 0, 11]);
    expect(Object.keys(notes).sort()).toEqual(chunk.filter(q => notes[q.id]).map(q => q.id).sort());
    for (const q of chunk.filter(q => notes[q.id])) expect(q.studyNotes.sections).toEqual(expect.arrayContaining(notes[q.id].sections));
    for (const q of bank.filter(q => ch20[q.id])) expect(q.studyNotes.sections).toEqual(expect.arrayContaining(ch20[q.id].sections));
    for (const source of [previous, clinical, crucial]) {
      for (const q of source.filter(q => notes[q.id])) {
        const live = bank.find(x => x.id === q.id);
        for (const key of ['answer', 'modelAnswer', 'additionalAnswer']) {
          if (q[key] !== undefined) expect(live[key]).toEqual(q[key]);
        }
      }
    }
  });

  it('renders every card with emphasized clinical detail and no visible source references', () => {
    const view = render(<BoardRevisionNotes notes={chunk[0].studyNotes} />);
    for (const q of chunk) {
      view.rerender(<BoardRevisionNotes notes={q.studyNotes} />);
      expect(q.studyNotes.sections.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.studyNotes.sections.every(s => s.items?.length || s.paragraphs?.length || s.table?.rows.length), q.id).toBe(true);
      expect(view.container.querySelectorAll('section').length, q.id).toBeGreaterThanOrEqual(2);
      expect(view.container.textContent, q.id).not.toContain('**');
      expect(view.container.textContent, q.id).not.toContain('Πρότυπη προφορική απάντηση');
      expect(q.studyNotes.hideSources, q.id).toBe(true);
      expect(view.container.querySelector('a'), q.id).toBeNull();
    }
  });

  it('uses notes for historical, clinical and crucial questions and retains progress and navigation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderAnswer = vi.fn(() => <p>Imported answer</p>);
    const renderCrucial = vi.fn(() => <p>Model answer</p>);
    const mastered = vi.fn();
    const user = userEvent.setup();
    for (const id of ['1Ab6', 'oral_core_034', 'Q27', 'Q91']) {
      const q = chunk.find(q => q.id === id);
      const view = render(<MemoryRouter initialEntries={[`/oral/chapters/${q.chapter}/questions/${id}`]}>
        <OralWorkspace oralProgress={{ mastered: {} }} profileId="ch21to24-test" onQuestionMastered={mastered} renderAnswer={renderAnswer} renderCrucial={renderCrucial} />
      </MemoryRouter>);
      const article = await screen.findByRole('article');
      expect(await within(article).findByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
      await user.click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
      expect(mastered).toHaveBeenLastCalledWith(id, true);
      if (id === '1Ab6') {
        const chapter = bank.filter(x => x.chapter === q.chapter);
        const next = chapter[chapter.findIndex(x => x.id === id) + 1];
        await user.click(within(article).getByRole('button', { name: /Επόμενη/ }));
        expect(await screen.findByRole('heading', { name: next.text })).toBeInTheDocument();
      }
      view.unmount();
    }
    expect(renderAnswer).not.toHaveBeenCalled();
    expect(renderCrucial).not.toHaveBeenCalled();
  });

  it('indexes clinical detail and psychotherapy distinctions in search', async () => {
    const index = await getSearchIndex();
    for (const [id, term] of [['Q5', '48'], ['Q35', '6 μήνες'], ['Q36', 'Hoover'], ['3A6', 'οκτώ φάσεις'], ['oral_core_029_fu03', 'Εκλογίκευση']]) {
      const result = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === id);
      expect(result.body).toContain(term);
      expect(result.body).not.toContain('**');
      expect(result.path).toBe(`/oral/chapters/${chunk.find(q => q.id === id).chapter}/questions/${id}`);
    }
  });
});
