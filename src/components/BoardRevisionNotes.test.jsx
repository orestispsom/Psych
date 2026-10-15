import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BoardRevisionNotes from './BoardRevisionNotes';
import OralWorkspace from './OralWorkspace';
import notes from '../data/oralChapter13Notes';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import crucial from '../data/crucialQuestionsContent';
import { buildOralBank } from '../data/oralChapters';
import { getSearchIndex } from '../lib/searchIndex';

afterEach(cleanup);

describe('Chapter 13 board revision', () => {
  const bank = buildOralBank(previous, clinical, crucial);

  it('covers every active Chapter 13 question and leaves chapters awaiting revision in their current format', () => {
    const chapter = bank.filter(q => q.chapter === 13);
    expect(chapter).toHaveLength(23);
    expect(Object.keys(notes).sort()).toEqual(chapter.map(q => q.id).sort());
    expect(bank.filter(q => ![13, 14].includes(q.chapter)).every(q => !q.studyNotes)).toBe(true);
    for (const q of chapter) {
      expect(q.studyNotes.sections.length).toBeGreaterThanOrEqual(2);
      expect(q.studyNotes.sources.length).toBeGreaterThan(0);
      expect(q.studyNotes.sections.every(s => s.items.some(x => x.includes('**')))).toBe(true);
    }
  });

  it('renders critical information as emphasis with readable source links', () => {
    const { container } = render(<BoardRevisionNotes notes={notes.ch13_binge_arfid} />);
    expect(screen.getByText('Τουλάχιστον 3 από τα 5')).toBeInTheDocument();
    expect(container.querySelectorAll('strong').length).toBeGreaterThan(5);
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('Πρότυπη προφορική απάντηση');
    expect(screen.getAllByRole('link', { hidden: true }).every(link => link.href.startsWith('https://'))).toBe(true);
  });

  it('shows the revision format for both crucial and clinical cards while preserving completion and navigation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const mastered = vi.fn();
    const renderCrucial = vi.fn(() => <p>Old model answer</p>);
    const renderAnswer = vi.fn(() => <p>Old clinical answer</p>);
    render(<MemoryRouter initialEntries={['/oral/chapters/13/questions/Q62']}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="notes-test" onQuestionMastered={mastered}
        renderCrucial={renderCrucial} renderAnswer={renderAnswer} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(await within(article).findByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
    expect(within(article).getByText('Διάγνωση — DSM-5-TR: και τα 3 βασικά στοιχεία')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
    expect(mastered).toHaveBeenCalledWith('Q62', true);
    await user.click(within(article).getByRole('button', { name: /Επόμενη/ }));
    expect(await screen.findByRole('heading', { name: /Ποιος είναι ο αρχικός σωματικός έλεγχος/ })).toBeInTheDocument();
    expect(screen.getByText('Σημειώσεις μελέτης & επανάληψης')).toBeInTheDocument();
    expect(renderCrucial).not.toHaveBeenCalled();
    expect(renderAnswer).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('indexes the new clinical detail with no raw emphasis markers', async () => {
    const index = await getSearchIndex();
    const item = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === 'ch13_binge_arfid');
    expect(item.body).toContain('3 από τα 5');
    expect(item.body).not.toContain('**');
    const sleep = index.find(x => x.scope === 'oral' && x.state.oralQuestionId === 'ch13_sleep_differential');
    expect(sleep.body).toContain('κορεσμού τρανσφερρίνης');
  });
});
