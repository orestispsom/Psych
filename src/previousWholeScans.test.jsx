import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';
import scans from './data/exam-recall/previous-whole-scans.json';
import WrongAnswerPractice from './components/WrongAnswerPractice';

const topic = 'Προηγούμενα Ολόκληρα';
const additions = bank.filter(question => question.source === 'previous_whole_scans');
const storageKey = 'psychiatry-study-profiles-v1';
const letters = ['Α', 'Β', 'Γ', 'Δ', 'Ε'];

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

function boot(path, progress = {}) {
  window.history.replaceState({}, '', path);
  localStorage.setItem(storageKey, JSON.stringify({
    version: 1, activeProfileId: 'scan-tester', profiles: {
      'scan-tester': { id: 'scan-tester', name: 'Scan Tester', mcqProgress: progress },
    },
  }));
  return render(<BrowserRouter><App /></BrowserRouter>);
}

it('preserves all 98 source records, option order and handwritten-key provenance', () => {
  expect(additions).toHaveLength(98);
  expect(additions.map(question => question.id)).toEqual(Array.from({ length: 98 }, (_, i) => 3480 + i));
  expect(new Set(bank.map(question => question.id)).size).toBe(bank.length);
  for (const source of scans.items) {
    const question = additions.find(item => item.id === source.id);
    const expectedOptions = [...source.originalOptions];
    let expectedStem = source.originalStem;
    for (const edit of source.typographicEdits) {
      if (edit.field === 'stem') expectedStem = expectedStem.replace(edit.before, edit.after);
      else {
        const index = Number(edit.field.match(/\d+/)[0]);
        expectedOptions[index] = expectedOptions[index].replace(edit.before, edit.after);
      }
    }
    expect(question.stem, `Source stem ${source.n}`).toBe(expectedStem);
    expect(question.options, `Source choices ${source.n}`).toEqual(expectedOptions);
    expect(letters[question.correct], `Source key ${source.n}`).toBe(source.correctLetter);
    expect(question.topic).toBe(topic);
    expect(question.answerKeyBasis).toBe('scan_annotations');
    expect(question.preserveOptionOrder).toBe(true);
    expect(question.reviewStatus).toBe('finalized_as_scanned');
    expect(question.qualityStatus).toBe('unchecked');
    expect(question.explanation).not.toContain('HOLD');
  }
  // Protect the user's explicit example and keys previously changed on
  // clinical/editorial grounds instead of following the source markings.
  for (const [id, key] of [[3481, 3], [3494, 3], [3508, 4], [3549, 3], [3567, 3]]) {
    expect(bank.find(question => question.id === id).correct, `Scan key ${id}`).toBe(key);
  }
  expect(bank.find(question => question.id === 3494).options[3]).toBe('Διακοπή κατάχρησης ουσιών');
  expect(bank.find(question => question.id === 3485).explanation).toContain('στάδιο 3 και 4');
  expect(bank.find(question => question.id === 3557).options[4]).toBe('Προκύπτουν μετά από μη φυσιολογικές');
});

it('shows the requested category with all 98 questions and starts the complete set', async () => {
  const user = userEvent.setup();
  const { container } = boot('/mcq/category');
  const label = await screen.findByText(topic, { exact: true });
  const category = label.closest('button');
  expect(category).not.toBeDisabled();
  expect(category).toHaveTextContent('0/98 απαντημένες');
  await user.click(category);
  await user.click(screen.getByRole('button', { name: 'Όλες οι υπόλοιπες' }));
  await waitFor(() => expect(container.querySelector('.mcq-q-index')).toHaveTextContent('1 / 98'));
  const id = Number(container.querySelector('.mcq-q-id').textContent.replace('#', ''));
  expect(additions.some(question => question.id === id)).toBe(true);
}, 20000);

it('grades 3494 using the scan-marked Δ and displays its source explanation', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const user = userEvent.setup();
  const question = bank.find(item => item.id === 3494);
  const { container } = boot('/mcq/bookmarks', {
    bookmarks: { 3494: true }, questions: {}, attempts: [], sprintSessions: [], writtenExamSessions: [],
  });
  expect(await screen.findByText(question.stem, { exact: true })).toBeInTheDocument();
  expect([...container.querySelectorAll('.options-list .option-letter')]
    .map(node => node.textContent)).toEqual(letters);
  expect([...container.querySelectorAll('.options-list button')][3]).toHaveTextContent('Διακοπή κατάχρησης ουσιών');
  await user.click(within(container.querySelector('.options-list')).getByText('Διακοπή κατάχρησης ουσιών', { exact: true }));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(container.querySelector('.explanation-box'))
    .toHaveTextContent(question.explanation.replace(/\s+/g, ' ').trim()));
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(saved.profiles['scan-tester'].mcqProgress.questions[3494].correctCount).toBe(1);
  });
}, 20000);

it('keeps source letter references in their original positions during mistake retries', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const question = bank.find(item => item.id === 3554);
  const { container } = render(<WrongAnswerPractice questions={[question]} title={topic} onBack={() => {}} />);
  const options = [...container.querySelectorAll('.options-list button')];
  expect(options).toHaveLength(5);
  question.options.forEach((option, index) => expect(options[index]).toHaveTextContent(option));
  expect(options[3]).toHaveTextContent('Το Α και το Β');
});
