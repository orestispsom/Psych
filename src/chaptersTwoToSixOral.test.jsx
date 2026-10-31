import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import OralWorkspace from './components/OralWorkspace';
import { buildOralBank, orderOralQuestions } from './data/oralChapters';
import { chapters2to6Order } from './data/oralChapters2to6Notes';
import previous from './data/oral';
import clinical from './data/oralCore';
import crucial from './data/crucialQuestionsContent';
import { getSearchIndex } from './lib/searchIndex';

afterEach(cleanup);
const bank = buildOralBank(previous, clinical, crucial);
const notes = id => JSON.stringify(bank.find(q => q.id === id).studyNotes);
function open(path) {
  render(<MemoryRouter initialEntries={[path]}>
    <OralWorkspace oralProgress={{ mastered: {} }} onQuestionMastered={() => {}}
      renderAnswer={text => <p>{text}</p>} renderCrucial={() => null} />
  </MemoryRouter>);
}

describe('Chapters 2–6 editorial review', () => {
  it('orders the restrained set of questions and avoids template sections or duplicate headings', () => {
    const questions = bank.filter(q => q.chapter >= 2 && q.chapter <= 6);
    expect(questions).toHaveLength(37);
    for (const [chapter, order] of Object.entries(chapters2to6Order)) {
      expect(orderOralQuestions(questions.filter(q => q.chapter === Number(chapter))).map(q => q.id)).toEqual(order);
    }
    for (const q of questions) {
      const titles = q.studyNotes.sections.map(s => s.title);
      expect(new Set(titles).size, q.id).toBe(titles.length);
      expect(titles.join(' '), q.id).not.toMatch(/Άξονας ανάκλησης|Συχνές παγίδες|Βασικά σημεία για τις εξετάσεις|Πρότυπη προφορική απάντηση/i);
      expect(q.text, q.id).not.toMatch(/Πώς (εξετάζετε|διερευνάτε|αξιολογείτε)/);
    }
  });

  it('makes the recalled genetics questions findable without collapsing distinct concepts', () => {
    expect(bank.find(q => q.id === '5A6').text).toBe('Τι είναι η επίσταση;');
    expect(bank.find(q => q.id === '5A3').text).not.toContain('μικρό risk');
    expect(notes('5A3')).not.toContain('παραπάνω εκτιμήσεις');
    for (const term of ['μονοζυγωτικοί', 'υιοθεσίας', 'Διεισδυτικότητα', 'Ψυχογενής ανορεξία', 'δεν καθορίζει πλήρως']) expect(notes('Q96')).toContain(term);
    for (const term of ['Μεθυλίωση DNA', 'Τροποποιήσεις ιστονών', 'microRNA', 'Κάπνισμα', 'διαγενεακής']) expect(notes('ch5_epigenetics')).toContain(term);
    for (const term of ['MAOA', 'Στρες–διάθεση', 'Διαφορετική ευαισθησία', 'Παθητική', 'Προκλητική', 'Ενεργητική', 'υπερχιασματικό', 'clock genes']) expect(notes('ch5_gene_environment')).toContain(term);
    expect(notes('Q96')).not.toContain('Γονίδια και περιβάλλον: παραδείγματα διαφορετικών σχέσεων');
    expect(notes('5A6')).not.toContain('Κύριοι μηχανισμοί');
    expect(notes('jan2026_22')).not.toContain('Φλοιοραβδωτοθαλαμοφλοιώδη');
    expect(notes('jan2026_05')).toContain('Φλοιοραβδωτοθαλαμοφλοιώδη');
    expect(notes('exam_neurotransmitters')).not.toContain('Κατάληψη D2');
    expect(notes('Q95')).toContain('65–80%');
    expect(notes('Q14')).not.toContain('Η συναπτική ωρίμανση και το κλάδεμα');
    expect(notes('jan2026_03')).toContain('Η συναπτική ωρίμανση και το κλάδεμα');
  });

  it('preserves the clinical distinctions and fills the assessment/research gaps', () => {
    expect(notes('Q8')).toContain('αυτοκτονικού ιδεασμού δεν αποδεικνύουν');
    expect(notes('Q8')).toContain('συγκεκριμένη απόφαση και ώρα');
    expect(notes('Q9')).toContain('ελάχιστος ύπνος');
    expect(notes('Q9')).toContain('σίτιση, ενυδάτωση');
    expect(notes('Q9')).toContain('δεν αποφασίζει μόνη της');
    expect(notes('Q1')).toContain('ιστορικό περιγράφει τη διαχρονική πορεία');
    expect(notes('ch6_evidence')).toContain('PICO');
    expect(notes('ch6_diagnostic_accuracy')).toContain('90/180 = 50%');
    expect(notes('5A10')).toContain('απόκρυψη κατανομής');
    expect(notes('5A12')).toContain('Δεν είναι η πιθανότητα να είναι σωστή η μηδενική υπόθεση');
  });

  it('renders direct chapter titles, the full epigenetics answer and the next related question', async () => {
    const user = userEvent.setup();
    open('/oral/chapters/5');
    const index = await screen.findByRole('region', { name: 'Ερωτήσεις κεφαλαίου' });
    expect(within(index).getAllByRole('link')).toHaveLength(17);
    expect(within(index).queryByText(/Μεθυλίωση DNA|Παθητική|MAOA/)).not.toBeInTheDocument();
    await user.click(within(index).getByRole('link', { name: /Τι είναι η επιγενετική/ }));
    expect(await screen.findByRole('heading', { name: 'Κύριοι μηχανισμοί' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Τα microRNA/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Επόμενη/ }));
    expect(await screen.findByRole('heading', { name: 'Συσχέτιση γονιδίων–περιβάλλοντος' })).toBeInTheDocument();
  });

  it.each([
    ['oral_core_007_fu03', 'Κίνδυνος, αυτοκτονικότητα και τεκμηρίωση'],
    ['oral_core_030_fu03', 'Κίνδυνος, αυτοκτονικότητα και τεκμηρίωση'],
    ['oral_core_030_fu04', 'Κίνδυνος, αυτοκτονικότητα και τεκμηρίωση'],
    ['oral_core_004_fu06', 'Μανία, αυτοπαραμέληση και ενημέρωση οικογένειας'],
    ['oral_core_031_fu02', 'Μανία, αυτοπαραμέληση και ενημέρωση οικογένειας'],
    ['oral_core_031_fu03', 'Μανία, αυτοπαραμέληση και ενημέρωση οικογένειας'],
    ['3D6', 'Συστήματα του στρες'],
  ])('opens the merged answer from old bookmark %s', async (id, heading) => {
    open(`/oral/chapters/${id === '3D6' ? 5 : 4}/questions/${id}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('indexes complete new answers at their correct chapter paths', async () => {
    const index = (await getSearchIndex()).filter(q => q.scope === 'oral');
    const epigenetics = index.find(q => q.state.oralQuestionId === 'ch5_epigenetics');
    expect(epigenetics.path).toBe('/oral/chapters/5/questions/ch5_epigenetics');
    expect(epigenetics.body).toContain('microRNA');
    expect(index.find(q => q.state.oralQuestionId === 'ch6_diagnostic_accuracy').body).toContain('90/180 = 50%');
    expect(index.some(q => q.state.oralQuestionId === '3D6')).toBe(false);
  });
});
