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

  it.each([
    [4, 'Q8', 'Λειτουργική κλινική αξιολόγηση', 'Στάθμιση'],
    [25, 'Q83', 'Μετά από διακοπή', '5 ημιζωές'],
    [1, '1Aa2', 'Συμπτώματα πρώτης τάξης', 'Schneider'],
  ])('opens the converted bank entry %s/%s through its existing route', async (chapter, id, heading, detail) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderCrucial = vi.fn(() => <p>Old model answer</p>);
    const renderAnswer = vi.fn(() => <p>Old brief answer</p>);
    render(<MemoryRouter initialEntries={[`/oral/chapters/${chapter}/questions/${id}`]}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="bank-notes-review" onQuestionMastered={() => {}}
        renderCrucial={renderCrucial} renderAnswer={renderAnswer} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(within(article).getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(article.textContent).toContain(detail);
    expect(within(article).queryAllByRole('link').every(link => link.getAttribute('href').startsWith('/oral/'))).toBe(true);
    expect(renderCrucial).not.toHaveBeenCalled();
    expect(renderAnswer).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('keeps Chapter 13 coverage while supporting the informational revision across chapters', () => {
    const chapter = bank.filter(q => q.chapter === 13);
    expect(chapter).toHaveLength(23);
    expect(Object.keys(notes).sort()).toEqual(chapter.map(q => q.id).sort());
    for (const q of chapter) {
      expect(q.studyNotes.sections.length).toBeGreaterThanOrEqual(2);
      expect(q.studyNotes.hideSources).toBe(true);
      expect(q.studyNotes.sections.every(s => s.items?.length || s.paragraphs?.length || s.table?.rows.length)).toBe(true);
    }
  });

  it('renders explanatory paragraphs and accessible tables without source attribution', () => {
    const sleep = bank.find(q => q.id === 'Q67');
    const { container } = render(<BoardRevisionNotes notes={sleep.studyNotes} />);
    const table = screen.getByRole('region', { name: 'Χαρακτηριστικά των σταδίων' });
    expect(within(table).getByRole('columnheader', { name: 'Στάδιο' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'REM' })).toBeInTheDocument();
    expect(screen.getByText(/Τα όνειρα δεν περιορίζονται αποκλειστικά/)).toBeInTheDocument();
    expect(container.querySelector('details')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('searches table cells and explanatory prose and opens a new entry with stable completion', async () => {
    const index = await getSearchIndex();
    expect(index.find(x => x.state?.oralQuestionId === 'exam_hepatic').body).toContain('γλυκουρονίδωση');
    expect(index.find(x => x.state?.oralQuestionId === 'Q67').body).toContain('Υπνικές άτρακτοι');
    const mastered = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/oral/chapters/25/questions/exam_flumazenil']}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="exam-notes" onQuestionMastered={mastered}
        renderAnswer={() => null} renderCrucial={() => null} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(within(article).getByRole('heading', { name: 'Μικτή υπερδοσολογία' })).toBeInTheDocument();
    await userEvent.setup().click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
    expect(mastered).toHaveBeenCalledWith('exam_flumazenil', true);
    vi.restoreAllMocks();
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

  it('opens the recovered DAT question and preserves completion using its stable ID', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const mastered = vi.fn();
    const renderCrucial = vi.fn(() => <p>Old model answer</p>);
    render(<MemoryRouter initialEntries={['/oral/chapters/14/questions/exam_dat_scan']}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="dat-review" onQuestionMastered={mastered}
        renderCrucial={renderCrucial} renderAnswer={() => null} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(within(article).getByRole('heading', { name: 'Έλεγχος φαρμάκων πριν από την εξέταση' })).toBeInTheDocument();
    expect(within(article).getByText(/Δεν διακόπτονται συλλήβδην/)).toBeInTheDocument();
    expect(within(article).queryByRole('link')).not.toBeInTheDocument();
    await userEvent.setup().click(within(article).getByRole('button', { name: 'Ολοκληρώθηκε' }));
    expect(mastered).toHaveBeenCalledWith('exam_dat_scan', true);
    expect(renderCrucial).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('displays the mixed-overdose warning through the revised crucial route', async () => {
    const renderCrucial = vi.fn(() => <p>Old model answer</p>);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/oral/chapters/25/questions/Q88']}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="overdose-review" onQuestionMastered={() => {}}
        renderCrucial={renderCrucial} renderAnswer={() => null} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    expect(within(article).getByRole('heading', { name: 'Μικτή αμιτριπτυλίνη και βενζοδιαζεπίνη' })).toBeInTheDocument();
    expect(within(article).getByText(/Η φλουμαζενίλη αποφεύγεται/)).toBeInTheDocument();
    expect(within(article).getByText(/QRS >100 ms/)).toBeInTheDocument();
    expect(within(article).queryByRole('link')).not.toBeInTheDocument();
    expect(renderCrucial).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('shows the classification distinction in a revised past-exam answer', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const renderAnswer = vi.fn(() => <p>Old brief answer</p>);
    render(<MemoryRouter initialEntries={['/oral/chapters/7/questions/3A4']}>
      <OralWorkspace oralProgress={{ mastered: {} }} profileId="stress-recall-review" onQuestionMastered={() => {}}
        renderCrucial={() => null} renderAnswer={renderAnswer} />
    </MemoryRouter>);
    const article = await screen.findByRole('article');
    const comparison = within(article).getByRole('region', { name: 'Ταξινόμηση, χρόνος και συμπτώματα' });
    expect(within(comparison).getByRole('rowheader', { name: 'Οξεία διαταραχή στρες — DSM-5-TR' })).toBeInTheDocument();
    expect(within(comparison).getByRole('rowheader', { name: 'Οξεία αντίδραση στρες — ICD-11' })).toBeInTheDocument();
    expect(within(article).queryAllByRole('link').every(link => link.getAttribute('href').startsWith('/oral/'))).toBe(true);
    expect(renderAnswer).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('indexes the added follow-up detail while retaining the older core answer', async () => {
    const index = await getSearchIndex();
    const body = id => index.find(x => x.scope === 'oral' && x.state.oralQuestionId === id).body;
    expect(body('3D8')).toContain('Φυσιολογικό πένθος');
    expect(body('3D8')).toContain('άρνηση–θυμός–διαπραγμάτευση');
    expect(body('Q64')).toContain('Πώς εφαρμόζεται η CBT-E');
    expect(body('Q64')).toContain('60 mg/ημέρα');
    expect(body('Q78')).toContain('τρία από τα πέντε');
    expect(body('Q80')).toContain('Συναισθηματική άμβλυνση');
    expect(body('exam_stabilizers')).toContain('4–12 μg/mL');
  });
});
