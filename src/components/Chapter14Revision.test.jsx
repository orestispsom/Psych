import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BoardRevisionNotes from './BoardRevisionNotes';
import OralWorkspace from './OralWorkspace';
import notes from '../data/oralChapter14Notes';
import chapter13 from '../data/oralChapter13Notes';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import crucial from '../data/crucialQuestionsContent';
import { buildOralBank } from '../data/oralChapters';
import { getSearchIndex } from '../lib/searchIndex';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Chapter 14 revision notes', () => {
  const bank = buildOralBank(previous, clinical, crucial);
  const chapter = bank.filter(q => q.chapter === 14);

  it('revises all 32 active questions while preserving imported answer fields and stable IDs', () => {
    expect(chapter).toHaveLength(32);
    expect(Object.keys(notes).sort()).toEqual(chapter.filter(q => notes[q.id]).map(q => q.id).sort());
    expect(bank.filter(q => q.studyNotes).every(q => q.studyNotes.hideSources)).toBe(true);
    for (const q of bank.filter(q => q.chapter === 13 && q.id !== 'Q67')) expect(q.studyNotes.sections).toEqual(expect.arrayContaining(chapter13[q.id].sections));
    for (const q of crucial) expect(bank.find(x => x.id === q.id)).toMatchObject(q);
    for (const q of clinical.filter(q => chapter.some(x => x.id === q.id))) {
      expect(bank.find(x => x.id === q.id).answer).toBe(q.answer);
    }
  });

  it('renders every note set with complete emphasis markup and hidden source metadata', () => {
    const view = render(<BoardRevisionNotes notes={chapter[0].studyNotes} />);
    for (const q of chapter) {
      view.rerender(<BoardRevisionNotes notes={q.studyNotes} />);
      expect(q.studyNotes.sections.length, q.id).toBeGreaterThanOrEqual(2);
      expect(view.container.querySelectorAll('section').length, q.id).toBeGreaterThanOrEqual(2);
      expect(view.container.textContent, q.id).not.toContain('**');
      expect(view.container.textContent, q.id).not.toContain('Πρότυπη προφορική απάντηση');
      expect(q.studyNotes.hideSources, q.id).toBe(true);
      expect(view.container.querySelector('a'), q.id).toBeNull();
    }
  });

  it('uses revision notes on a previous-exam card and on a crucial card, retaining navigation and progress', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderAnswer = vi.fn(() => <p>Imported answer</p>);
    const renderCrucial = vi.fn(() => <p>Model answer</p>);
    const mastered = vi.fn();
    const user = userEvent.setup();
    const props = { oralProgress: { mastered: {} }, profileId: 'ch14-test', onQuestionMastered: mastered, renderAnswer, renderCrucial };
    const view = render(<MemoryRouter initialEntries={['/oral/chapters/14/questions/1B3']}>
      <OralWorkspace {...props} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(await within(article).findByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
    await user.click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
    expect(mastered).toHaveBeenCalledWith('1B3', true);
    await user.click(within(article).getByRole('button', { name: /Επόμενη/ }));
    expect(await screen.findByRole('heading', { name: /Ποιοι παράγοντες αυξάνουν τον κίνδυνο/ })).toBeInTheDocument();
    view.unmount();
    render(<MemoryRouter initialEntries={['/oral/chapters/14/questions/Q45']}>
      <OralWorkspace {...props} />
    </MemoryRouter>);
    expect(await screen.findByText('Ανίχνευση — 4AT και εντατική θεραπεία')).toBeInTheDocument();
    expect(renderAnswer).not.toHaveBeenCalled();
    expect(renderCrucial).not.toHaveBeenCalled();
    expect(screen.queryByText('Πηγές & διαγνωστικό πλαίσιο')).not.toBeInTheDocument();
  });

  it('indexes added diagnostic detail from all three source kinds', async () => {
    const index = await getSearchIndex();
    for (const [id, term] of [['3C2', 'ενδεικτικός βιοδείκτης'], ['Q53', 'πλειοκυττάρωση'], ['oral_core_012_fu01', 'Κοινωνική νόηση']]) {
      const result = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === id);
      expect(result.body).toContain(term);
      expect(result.body).not.toContain('**');
      expect(result.path).toBe(`/oral/chapters/14/questions/${id}`);
    }
  });
});
