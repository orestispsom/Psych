import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import OralWorkspace from './components/OralWorkspace';
import { buildOralBank, orderOralQuestions } from './data/oralChapters';
import previous from './data/oral';
import clinical from './data/oralCore';
import crucial from './data/crucialQuestionsContent';
import { getSearchIndex } from './lib/searchIndex';

afterEach(cleanup);

function openChapter(path = '/oral/chapters/1') {
  render(<MemoryRouter initialEntries={[path]}>
    <OralWorkspace oralProgress={{ mastered: {} }} onQuestionMastered={() => {}}
      renderAnswer={text => <p>{text}</p>} renderCrucial={() => null} />
  </MemoryRouter>);
}

describe('Chapter 1 psychopathology coverage', () => {
  it('separates delusional themes and associates syndromes with the specific relevant theme', async () => {
    openChapter('/oral/chapters/1/questions/ch1_delusional_themes');
    const types = await screen.findByRole('region', { name: 'Τύποι παραληρητικών ιδεών' });
    for (const name of ['Διωκτικές', 'Αναφοράς', 'Μεγαλείου', 'Θρησκευτικές', 'Ενοχής', 'Πτωχείας', 'Σωματικές', 'Παρασιτώσεως', 'Πρόσδοσης σκέψης', 'Αφαίρεσης σκέψης', 'Εκπομπής σκέψης']) {
      expect(within(types).getByRole('rowheader', { name, exact: true })).toBeInTheDocument();
    }
    const row = name => within(types).getByRole('rowheader', { name, exact: true }).closest('tr');
    expect(row('Αναφοράς')).toHaveTextContent('δεν είναι υποχρεωτικά απειλητική');
    expect(row('Διωκτικές')).toHaveTextContent('εχθρική πρόθεση');
    expect(row('Παρασιτώσεως')).toHaveTextContent('Ekbom');
    expect(row('Σωματικές')).not.toHaveTextContent('Ekbom');
    expect(row('Μηδενιστικές')).toHaveTextContent('Cotard');
    expect(row('Ζηλοτυπικές')).toHaveTextContent('Othello');
    expect(row('Ερωτομανιακές')).toHaveTextContent('de Clérambault');
    expect(screen.getByRole('heading', { name: 'Επινεμόμενο παραλήρημα — folie à deux' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Σχέση με τη διάθεση' })).toBeInTheDocument();
  });

  it('defines the complete mood and affect phenomena rather than only mentioning their names', () => {
    const question = buildOralBank(previous, clinical, crucial).find(q => q.id === 'ch1_mood_affect');
    const section = title => question.studyNotes.sections.find(s => s.title === title);
    const experience = section('Διαταραχές της συναισθηματικής βίωσης').table.rows;
    expect(experience.find(([name]) => name === 'Ανηδονία / υποηδονία')[1]).toContain('συνήθως ευχάριστες δραστηριότητες');
    expect(experience.find(([name]) => name === 'Αλεξιθυμία')[1]).toContain('διάκρισής τους από σωματικές αισθήσεις');
    expect(experience.find(([name]) => name === 'Αίσθημα απώλειας συναισθήματος')[1]).toContain('παρατηρούμενη επιπέδωση');
    expect(experience.find(([name]) => name === 'Απάθεια')[1]).toContain('δεν είναι συνώνυμη της ανηδονίας');
    const expression = section('Μεταβολές της συναισθηματικής έκφρασης').table.rows;
    expect(expression.find(([name]) => name === 'Περίσφιξη της έκφρασης')[1]).toContain('ενδεχομένως εκούσια');
    expect(expression.find(([name]) => name === 'Συναισθηματική αμφιθυμία')[1]).toContain('από την αμφιβουλησία');
    expect(section('Μεταβολές της ποιότητας της διάθεσης').table.rows.find(([name]) => name === 'Άγχος / φόβος')[1]).toContain('μελλοντικής απειλής');
  });

  it('fills the source-guide gaps in their appropriate answers without changing the question set', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const text = id => JSON.stringify(bank.find(q => q.id === id).studyNotes);
    const coverage = {
      '3D1': ['Απαρτιωτική παραίσθηση', 'Συναισθηματική παραίσθηση', 'Λιλιπούτειες', 'Κοιναισθητικές', 'αιθουσαίες'],
      ch1_self_body: ['Ημισωματοαγνωσία', 'Κυριότητα και ιδιωτικότητα', 'απώλειας της συνέχειας'],
      ch1_speech: ['Τραυλισμός', 'κοπρολαλία', 'Βραδυφημία', 'διαταραχή προσωδίας'],
      ch1_thought_form: ['Παραλογική σκέψη'],
      oral_core_009_fu01: ['Ιδεοληπτικοί μηρυκασμοί', 'Ιδεοληπτική βραδύτητα', 'Νοητικές πράξεις', 'διαταραχή παρασυσσώρευσης'],
      ch1_delusional_experiences: ['Παραληρητική επανερμηνεία ανάμνησης', 'Παραληρητική παράθεση ιδεών'],
      ch1_delusional_themes: ['Σχέση με τη διάθεση', 'παρενόχληση'],
      ch1_memory: ['αναγνώριση πληροφοριών', 'Korsakoff', 'εντοπισμένη', 'επιλεκτική', 'υποβολή'],
      ch1_consciousness: ['Διαύγεια', 'Εύρος', 'Συνοχή', 'Λυκοφωτική κατάσταση', 'Ονειροειδής κατάσταση'],
      ch1_attention: ['Δυσκολία διατήρησης / διάσπαση προσοχής'],
      ch1_insight: ['SAI-E', 'Υψηλότερη βαθμολογία σημαίνει καλύτερη', 'BABS', 'Υψηλότερη βαθμολογία σημαίνει πτωχότερη'],
      exam_volition: ['Αρνητισμός', 'Αυτόματη υπακοή', 'ακινητική αλαλία'],
      oral_core_035: ['Επιληπτικές κινητικές εκδηλώσεις'],
      Q10: ['Παθοφυσιολογικά μοντέλα', 'Mitgehen', 'Ηχομιμία', 'αμανταδίνη ή μεμαντίνη'],
    };
    for (const [id, terms] of Object.entries(coverage)) for (const term of terms) expect(text(id), `${id}: ${term}`).toContain(term);
    expect(text('ch1_attention')).not.toContain('BABS');
    expect(text('Q10')).toContain('χωρίς να αποδεικνύει έναν μοναδικό μηχανισμό');
    expect(text('Q10')).toContain('Δεν υποκαθιστούν την έγκαιρη ηλεκτροσπασμοθεραπεία');
    expect(bank.filter(q => q.chapter === 1)).toHaveLength(20);
    expect(bank.find(q => q.id === '1Aa2').chapter).toBe(11);
  });

  it('renders the expanded emotional-experience definitions at the existing mood bookmark', async () => {
    openChapter('/oral/chapters/1/questions/ch1_mood_affect');
    const experience = await screen.findByRole('region', { name: 'Διαταραχές της συναισθηματικής βίωσης' });
    expect(within(experience).getByRole('rowheader', { name: 'Αλεξιθυμία', exact: true })).toBeInTheDocument();
    expect(within(experience).getByRole('cell', { name: /Δυσκολία αναγνώρισης, διαφοροποίησης/ })).toBeInTheDocument();
    expect(within(experience).getByRole('rowheader', { name: 'Ανηδονία / υποηδονία' })).toBeInTheDocument();
    expect(screen.queryByText(/Άξονας ανάκλησης|Συχνές παγίδες|Βασικά σημεία για τις εξετάσεις/)).not.toBeInTheDocument();
  });

  it('keeps the requested content with direct titles and consolidated answers', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const chapter = orderOralQuestions(bank.filter(q => q.chapter === 1));
    expect(chapter.map(q => q.id)).toEqual([
      'ch1_mood_affect', 'Q57', '3D1', 'ch1_self_body',
      'ch1_speech', 'ch1_thought_form', 'Q2', 'oral_core_009_fu01',
      'ch1_delusional_experiences', 'ch1_delusional_themes', 'ch1_misidentification',
      'exam_volition', 'oral_core_035', 'oral_core_035_fu02',
      'ch1_consciousness', 'ch1_attention', 'ch1_memory', 'ch1_confusion', 'ch1_insight', 'Q10',
    ]);
    for (const q of chapter) {
      expect(q.studyNotes?.sections.length, q.id).toBeGreaterThan(0);
      expect(q.studyNotes.sections.map(s => s.title).join(' ')).not.toMatch(/Άξονας ανάκλησης|Συχνές παγίδες|Βασικά σημεία για τις εξετάσεις|Πρότυπη προφορική απάντηση/i);
      expect(q.text).not.toMatch(/Πώς (εξετάζετε|διερευνάτε|αξιολογείτε)/);
    }
    expect(chapter.find(q => q.id === 'Q57').text).toBe('Ποία η διαφορά Απάθειας και Κατάθλιψης?');
    expect(chapter.find(q => q.id === 'Q2').text).toBe(crucial.find(q => q.id === 'Q2').title);
    expect(bank.some(q => q.id === 'ch1_definitions')).toBe(false);
    expect(bank.find(q => q.id === '1Aa2').chapter).toBe(11);
    const text = id => JSON.stringify(chapter.find(q => q.id === id).studyNotes);
    expect(text('ch1_misidentification')).toContain('intermetamorphosis');
    expect(text('oral_core_035')).toContain('Χορεία');
    expect(text('oral_core_035')).toContain('Τικ');
    expect(text('ch1_confusion')).toContain('υποκινητικό');
    expect(text('Q10')).toContain('Δεν τίθεται υποχρεωτική διάρκεια 24 ωρών');
    expect(chapter.find(q => q.id === 'Q10').studyNotes.sections.find(s => s.table)?.table.rows).toHaveLength(12);
  });

  it('shows the direct question titles and navigates in the revised sequence', async () => {
    const user = userEvent.setup();
    openChapter();
    const index = await screen.findByRole('region', { name: 'Ερωτήσεις κεφαλαίου' });
    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(20);
    expect(links[0]).toHaveTextContent('Τι είναι διάθεση και συναίσθημα');
    expect(links[19]).toHaveTextContent('Πώς αναγνωρίζετε την κατατονία');
    expect(within(index).queryByText(/σωσία|τουλάχιστον 3|λοραζεπάμη/i)).not.toBeInTheDocument();
    await user.click(within(index).getByRole('link', { name: /σύνδρομα παραληρητικής παραγνώρισης/ }));
    expect(await screen.findByText('Υποκειμενικοί σωσίες — subjective doubles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Επόμενη/ }));
    expect(await screen.findByRole('heading', { name: 'Τι γνωρίζετε για τις διαταραχές βούλησης;' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Προηγούμενη/ }));
    expect(await screen.findByRole('heading', { name: /σύνδρομα παραληρητικής παραγνώρισης/ })).toBeInTheDocument();
  });

  it.each([
    ['oral_core_017_fu02', 'Κατατονία, παρκινσονισμός και ακαθησία'],
    ['oral_core_035_fu05', 'Πρόσθετα κινητικά φαινόμενα'],
    ['oral_core_035_fu06', 'Πρόσθετα κινητικά φαινόμενα'],
    ['oral_core_035_fu03', 'Βαθμός μείωσης ψυχοκινητικότητας'],
    ['1Aa2', 'Συμπτώματα πρώτης τάξης'],
  ])('keeps the old %s bookmark usable after consolidation or movement', async (id, heading) => {
    openChapter(`/oral/chapters/1/questions/${id}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('updates search destinations and removes the deleted or merged cards', async () => {
    const oral = (await getSearchIndex()).filter(q => q.scope === 'oral');
    expect(oral.find(q => q.state.oralQuestionId === '1Aa2').path).toBe('/oral/chapters/11/questions/1Aa2');
    expect(oral.some(q => ['ch1_definitions', 'oral_core_017_fu02', 'oral_core_035_fu03', 'oral_core_035_fu05', 'oral_core_035_fu06'].includes(q.state.oralQuestionId))).toBe(false);
    expect(oral.find(q => q.state.oralQuestionId === 'Q10').body).toContain('Εναντίωση / gegenhalten');
  });

  it('renders the expanded catatonia answer at its existing bookmark', async () => {
    openChapter('/oral/chapters/1/questions/Q10');
    expect(await screen.findByRole('heading', { name: 'Τα 12 σημεία του DSM-5-TR' })).toBeInTheDocument();
    const criteria = screen.getByRole('region', { name: 'Τα 12 σημεία του DSM-5-TR' });
    expect(within(criteria).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('heading', { name: 'Σειρά αντιμετώπισης' })).toBeInTheDocument();
    expect(screen.getByText(/Επανεκτίμηση περίπου σε 5, 15 ή 30 λεπτά/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Επόμενη/ })).toBeDisabled();
  });
});
