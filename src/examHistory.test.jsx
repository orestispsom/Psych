import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';

const storageKey = 'psychiatry-study-profiles-v1';
const profile = () => Object.values(JSON.parse(localStorage.getItem(storageKey)).profiles)[0];
beforeEach(() => { localStorage.clear(); window.history.pushState({}, '', '/'); });
afterEach(() => { cleanup(); localStorage.clear(); });
async function boot(user) {
  const view = render(<BrowserRouter><App /></BrowserRouter>);
  await user.type(await screen.findByLabelText('Όνομα προφίλ'), 'HistoryTester');
  await user.click(screen.getByRole('button', { name: /Συνέχεια/ }));
  await waitFor(() => expect(view.container.querySelector('.home-modules')).toBeTruthy());
  await user.click(within(view.container.querySelector('.home-modules')).getByRole('button', { name: 'Πολλαπλής Επιλογής', exact: true }));
  await screen.findByText('Mini-test', {}, { timeout: 10000 });
  return view;
}

it.each([10, 25, 50, 100])('starts a mini-test with %i questions', async count => {
  const user = userEvent.setup();
  const { container } = await boot(user);
  await user.click(screen.getByText('Mini-test', { exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Mini-test' });
  await user.click(within(dialog).getByRole('button', { name: `${count} ερωτήσεις`, exact: true }));
  await waitFor(() => expect(container.querySelector('.mcq-q-index').textContent).toMatch(new RegExp(`/\\s*${count}\\b`)));
  expect(profile().mcqProgress.sprintSessions[0].questionIds).toHaveLength(count);
});

it('reopens saved results after reload, reviews mistakes, and retries without overwriting an unfinished exam', async () => {
  const user = userEvent.setup();
  let view = await boot(user);
  await user.click(screen.getByText('Προσομοίωση Εξετάσεων', { exact: true }));
  await waitFor(() => expect(profile().mcqProgress.writtenExamDraft).toBeTruthy());
  const question = bank.find(q => q.id === profile().mcqProgress.writtenExamDraft.questionIds[0]);
  const wrongIndex = (question.correct + 1) % question.options.length;
  await user.click(within(view.container.querySelector('.options-list')).getByText(question.options[wrongIndex], { exact: true }));
  await user.click(screen.getByRole('button', { name: 'Υποβολή εξέτασης' }));
  await user.click(screen.getByRole('button', { name: 'Υποβολή και αποτελέσματα' }));
  await waitFor(() => expect(profile().mcqProgress.writtenExamSessions).toHaveLength(1));
  const saved = profile().mcqProgress.writtenExamSessions[0];
  expect(saved.result.items).toHaveLength(100);
  expect(saved.result.wrongItems[0].selected).toBe(wrongIndex);
  expect(saved.optionOrders[question.id]).toBeTruthy();
  const answerCount = profile().mcqProgress.questions[question.id].attempts;

  // Start another simulation, then revisit the first one after a full remount.
  await user.click(screen.getByRole('button', { name: /Νέα προσομοίωση/ }));
  await waitFor(() => expect(profile().mcqProgress.writtenExamDraft).toBeTruthy());
  const draft = profile().mcqProgress.writtenExamDraft;
  view.unmount();
  window.history.pushState({}, '', '/mcq/written?review=' + encodeURIComponent(saved.id));
  view = render(<BrowserRouter><App /></BrowserRouter>);
  await screen.findByRole('button', { name: /Εξάσκηση μόνο των λαθών \(1\)/ });
  expect(profile().mcqProgress.questions[question.id].attempts).toBe(answerCount);
  expect(profile().mcqProgress.writtenExamDraft).toEqual(draft);
  await user.click(screen.getByRole('button', { name: /Ανασκόπηση λαθών/ }));
  expect(await screen.findByText(question.stem, { exact: true })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Results/ }));
  await user.click(screen.getByRole('button', { name: /Εξάσκηση μόνο των λαθών \(1\)/ }));
  expect(view.container.querySelector('.mcq-q-index').textContent).toMatch(/1\s*\/\s*1/);
  await user.click(within(view.container.querySelector('.options-list')).getByText(question.options[question.correct], { exact: true }));
  await user.keyboard('{Enter}');
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Επιστροφή στα αποτελέσματα' }));
  expect(screen.getByRole('button', { name: /Εξάσκηση μόνο των λαθών \(1\)/ })).toBeInTheDocument();
  expect(profile().mcqProgress.writtenExamDraft).toEqual(draft);
  expect(profile().mcqProgress.writtenExamSessions).toHaveLength(1);
}, 20000);


it('keeps the chosen mini-test length for the next test', async () => {
  const user = userEvent.setup();
  const { container } = await boot(user);
  await user.click(screen.getByText('Mini-test', { exact: true }));
  await user.click(screen.getByRole('button', { name: '25 ερωτήσεις', exact: true }));
  for (let index = 0; index < 25; index += 1) {
    await user.click(container.querySelector('.option-btn'));
    await user.keyboard('{Enter}');
    if (index < 24) await user.keyboard('{ArrowRight}');
  }
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Επόμενο Mini-test/ }));
  expect(container.querySelector('.mcq-q-index').textContent).toMatch(/1\s*\/\s*25/);
}, 20000);
