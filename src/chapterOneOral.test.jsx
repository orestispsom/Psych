import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import OralWorkspace from './components/OralWorkspace';
import { buildOralBank, orderOralQuestions } from './data/oralChapters';
import previous from './data/oral';
import clinical from './data/oralCore';
import crucial from './data/crucialQuestionsContent';

afterEach(cleanup);

function openChapter(path = '/oral/chapters/1') {
  render(<MemoryRouter initialEntries={[path]}>
    <OralWorkspace oralProgress={{ mastered: {} }} onQuestionMastered={() => {}}
      renderAnswer={text => <p>{text}</p>} renderCrucial={() => null} />
  </MemoryRouter>);
}

describe('Chapter 1 psychopathology coverage', () => {
  it('covers every requested domain and keeps the previous questions live', () => {
    const bank = buildOralBank(previous, clinical, crucial);
    const chapter = orderOralQuestions(bank.filter(q => q.chapter === 1));
    expect(chapter.map(q => q.id)).toEqual([
      'ch1_definitions', 'ch1_mood_affect', 'Q57', '3D1', 'ch1_self_body',
      'ch1_speech', 'ch1_thought_form', 'Q2', 'oral_core_009_fu01',
      'ch1_delusional_experiences', 'ch1_delusional_themes', 'ch1_misidentification', '1Aa2',
      'exam_volition', 'oral_core_035', 'oral_core_035_fu02', 'oral_core_035_fu03',
      'oral_core_035_fu05', 'oral_core_035_fu06', 'oral_core_017_fu02',
      'ch1_consciousness', 'ch1_attention', 'ch1_memory', 'ch1_confusion', 'ch1_insight', 'Q10',
    ]);
    for (const q of chapter) expect(q.studyNotes?.sections.length, q.id).toBeGreaterThan(0);
    const text = id => JSON.stringify(chapter.find(q => q.id === id).studyNotes);
    expect(text('ch1_misidentification')).toContain('intermetamorphosis');
    expect(text('oral_core_035')).toContain('Χορεία');
    expect(text('oral_core_035')).toContain('Τικ');
    expect(text('ch1_confusion')).toContain('υποκινητικό');
    expect(text('Q10')).toContain('Δεν τίθεται υποχρεωτική διάρκεια 24 ωρών');
    expect(chapter.find(q => q.id === 'Q10').studyNotes.sections.find(s => s.table)?.table.rows).toHaveLength(12);
  });

  it('shows prompts without answer content and navigates in the study sequence', async () => {
    const user = userEvent.setup();
    openChapter();
    const index = await screen.findByRole('region', { name: 'Ερωτήσεις κεφαλαίου' });
    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(26);
    expect(links[0]).toHaveTextContent('Τι είναι η ψυχοπαθολογία');
    expect(links[25]).toHaveTextContent('Αναπτύξτε το σύνδρομο της κατατονίας');
    expect(within(index).queryByText(/σωσία|τουλάχιστον 3|λοραζεπάμη/i)).not.toBeInTheDocument();
    await user.click(within(index).getByRole('link', { name: /σύνδρομα παραληρητικής παραγνώρισης/ }));
    expect(await screen.findByText('Υποκειμενικοί σωσίες — subjective doubles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Επόμενη/ }));
    expect(await screen.findByRole('heading', { name: /συμπτώματα πρώτης τάξης του Schneider/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Προηγούμενη/ }));
    expect(await screen.findByRole('heading', { name: /σύνδρομα παραληρητικής παραγνώρισης/ })).toBeInTheDocument();
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
