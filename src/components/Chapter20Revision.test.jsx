import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BoardRevisionNotes from './BoardRevisionNotes';
import OralWorkspace from './OralWorkspace';
import notes from '../data/oralChapter20Notes';
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
const bank = buildOralBank(previous, clinical, crucial);
const chapter = bank.filter(q => q.chapter === 20);
const earlier = { ...ch13, ...ch14, ...ch15, ...ch16, ...ch17to19 };

describe('Chapter 20 board revision', () => {
  it('covers the 29 prior and two additional questions and preserves imported records and earlier notes', () => {
    expect(chapter).toHaveLength(31);
    expect(Object.keys(notes).sort()).toEqual(chapter.filter(q => notes[q.id]).map(q => q.id).sort());
    for (const q of chapter.filter(q => notes[q.id])) expect(q.studyNotes.sections).toEqual(expect.arrayContaining(notes[q.id].sections));
    for (const q of bank.filter(q => earlier[q.id] && q.id !== 'Q67')) expect(q.studyNotes.sections).toEqual(expect.arrayContaining(earlier[q.id].sections));
    expect(bank.filter(q => q.studyNotes).every(q => q.studyNotes.hideSources)).toBe(true);
    for (const q of crucial.filter(q => chapter.some(x => x.id === q.id))) expect(bank.find(x => x.id === q.id)).toMatchObject(q);
    for (const q of clinical.filter(q => chapter.some(x => x.id === q.id))) expect(bank.find(x => x.id === q.id).answer).toBe(q.answer);
  });

  it('renders every note set with readable emphasis, sections and hidden source metadata', () => {
    const view = render(<BoardRevisionNotes notes={chapter[0].studyNotes} />);
    for (const q of chapter) {
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

  it('shows revision notes across all three source kinds and retains completion/navigation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderAnswer = vi.fn(() => <p>Imported answer</p>);
    const renderCrucial = vi.fn(() => <p>Model answer</p>);
    const mastered = vi.fn();
    const user = userEvent.setup();
    const props = { oralProgress: { mastered: {} }, profileId: 'ch20-test', onQuestionMastered: mastered, renderAnswer, renderCrucial };
    for (const id of ['1B6', 'oral_core_014_fu04', 'Q44']) {
      const view = render(<MemoryRouter initialEntries={[`/oral/chapters/20/questions/${id}`]}><OralWorkspace {...props} /></MemoryRouter>);
      const article = await screen.findByRole('article');
      expect(await within(article).findByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
      await user.click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
      expect(mastered).toHaveBeenLastCalledWith(id, true);
      if (id === '1B6') {
        await user.click(within(article).getByRole('button', { name: /Επόμενη/ }));
        expect(await screen.findByRole('heading', { name: 'Γιατί χορηγούμε θειαμίνη και πότε σε σχέση με τη γλυκόζη;' })).toBeInTheDocument();
      }
      view.unmount();
    }
    expect(renderAnswer).not.toHaveBeenCalled();
    expect(renderCrucial).not.toHaveBeenCalled();
  });

  it('makes corrected safety information and diagnostic detail searchable', async () => {
    const index = await getSearchIndex();
    for (const [id, term] of [
      ['oral_core_014_fu04', 'Η θεραπεία υπογλυκαιμίας δεν καθυστερεί'],
      ['3B7', '6-μονοακετυλομορφίνη'],
      ['Q43', '5–10% κάθε 2–4 εβδομάδες'],
      ['Q44', 'τουλάχιστον 4 από 9'],
    ]) {
      const result = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === id);
      expect(result.body).toContain(term);
      expect(result.body).not.toContain('**');
      expect(result.path).toBe(`/oral/chapters/20/questions/${id}`);
    }
  });
});
