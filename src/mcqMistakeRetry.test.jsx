import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';
import matchingSets from './data/mcqMatching.js';
import vignettes from './data/mcqVignettes.js';
import { dsm5trChapter01Questions } from './data/dsm5trSelfExamQuestions.js';

const storageKey = 'psychiatry-study-profiles-v1';
const store = () => JSON.parse(localStorage.getItem(storageKey));
const profile = () => Object.values(store().profiles)[0];
const mount = () => render(<BrowserRouter><App /></BrowserRouter>);
beforeEach(() => { localStorage.clear(); window.history.pushState({}, '', '/'); });
afterEach(() => { cleanup(); localStorage.clear(); });
async function boot(user, mode) {
  let view = mount();
  await user.type(await screen.findByLabelText('Όνομα προφίλ'), 'MistakeTester');
  await user.click(screen.getByRole('button', { name: /Συνέχεια/ }));
  await waitFor(() => expect(view.container.querySelector('.home-modules')).toBeTruthy());
  view.unmount();
  const saved = store();
  const p = Object.values(saved.profiles)[0];
  p.mcqProgress.bookmarks = { 1: true, 2: true };
  p.mcqProgress.questions[1] = { attempts: 1, wrongCount: 1, lastCorrect: false };
  localStorage.setItem(storageKey, JSON.stringify(saved));
  window.history.pushState({}, '', `/mcq/${mode}`);
  return mount();
}

it.each(['sprint', 'random', 'category', 'weakness', 'bookmarks', 'daily'])('retries only graded mistakes in %s and preserves the source test', async mode => {
  const user = userEvent.setup();
  const { container } = await boot(user, mode);
  if (mode === 'category') {
    await waitFor(() => expect(container.querySelector('.mcq-select .item:not([disabled])')).toBeTruthy());
    await user.click(container.querySelector('.mcq-select .item:not([disabled])'));
  }
  await waitFor(() => expect(container.querySelector('.mcq-q-index')).toBeTruthy());
  const id = Number(container.querySelector('.mcq-q-id').textContent.match(/#\s*(\d+)/)[1]);
  const question = bank.find(question => question.id === id);
  await user.click(within(container.querySelector('.options-list')).getByText(question.options[(question.correct + 1) % question.options.length], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  const initialDrafts = structuredClone(profile().mcqProgress.categoryDrafts);
  const originalStem = container.querySelector('.question-stem').textContent;
  const originalIndex = container.querySelector('.mcq-q-index').textContent;
  const originalAttempts = profile().mcqProgress.questions[id].attempts;
  await user.click(screen.getByRole('button', { name: 'Εξάσκηση μόνο των λαθών (1)' }));
  expect(screen.getByText(/Ερώτηση 1\/1/)).toBeInTheDocument();
  expect(container.querySelector('.question-stem').textContent).toBe(originalStem);
  expect(container.querySelector('.option-btn.selected')).toBeNull();
  await user.click(within(container.querySelector('.options-list')).getByText(question.options[question.correct], { exact: true }));
  await user.keyboard('{Enter}');
  expect(await screen.findByText('Όλες οι απαντήσεις σωστές!')).toBeInTheDocument();
  expect(profile().mcqProgress.questions[id].attempts).toBe(originalAttempts + 1);
  expect(profile().mcqProgress.attempts[0].mode).toBe('weakness');
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(container.querySelector('.mcq-q-index').textContent).toBe(originalIndex);
  expect(container.querySelector('.option-btn.incorrect')).toBeTruthy();
  expect(profile().mcqProgress.categoryDrafts).toEqual(initialDrafts);
}, 20000);

it('retries matching items with the original choice identities and restores the set', async () => {
  const user = userEvent.setup();
  const { container } = await boot(user, 'matching');
  await waitFor(() => expect(container.querySelector('.structured-options .structured-option')).toBeTruthy());
  const menuButton = container.querySelector('.structured-options .structured-option');
  await user.click(menuButton);
  const prompt = container.querySelector('.structured-question').textContent;
  const set = matchingSets.find(set => set.items.some(item => item.prompt === prompt));
  const item = set.items.find(item => item.prompt === prompt);
  const incorrectChoice = set.choices.find(choice => !item.correct.includes(choice.id));
  await user.click(screen.getByText(incorrectChoice.label, { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  await user.click(screen.getByRole('button', { name: 'Εξάσκηση μόνο των λαθών (1)' }));
  expect(container.querySelector('.question-stem').textContent).toBe(prompt);
  for (const id of item.correct) await user.click(screen.getByRole('button', { name: set.choices.find(choice => choice.id === id).label, exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('Όλες οι απαντήσεις σωστές!')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(container.querySelector('.structured-question').textContent).toBe(prompt);
  expect(container.querySelector('.choice-card.incorrect')).toBeTruthy();
}, 20000);

it('retries vignette mistakes with the full clinical case and preserves original answers', async () => {
  const user = userEvent.setup();
  const { container } = await boot(user, 'vignettes');
  await waitFor(() => expect(container.querySelector('.vignette-open-card')).toBeTruthy());
  await user.click(container.querySelector('.vignette-open-card'));
  await user.click(screen.getByRole('button', { name: /Έναρξη ερωτήσεων/ }));
  const vignette = vignettes[0];
  const question = vignette.questions[0];
  const wrongIndex = question.options.findIndex((_, index) => !question.correct.includes(index));
  await user.click(screen.getByText(question.options[wrongIndex], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  await user.click(screen.getByRole('button', { name: 'Εξάσκηση μόνο των λαθών (1)' }));
  expect(container.querySelector('.vignette-text').textContent).toBe(vignette.vignette);
  for (const index of question.correct) await user.click(screen.getByRole('button', { name: question.options[index], exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('Όλες οι απαντήσεις σωστές!')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(container.querySelector('.structured-option.incorrect')).toBeTruthy();
}, 20000);

it('retries DSM5 mistakes using the DSM answer key and preserves the chapter session', async () => {
  const user = userEvent.setup();
  const { container } = await boot(user, 'dsm5');
  await user.click(await screen.findByRole('button', { name: /Κεφάλαιο 1:/ }));
  const question = dsm5trChapter01Questions[0];
  await user.click(screen.getByText(question.options[(question.correct + 1) % question.options.length], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  await user.click(screen.getByRole('button', { name: 'Εξάσκηση μόνο των λαθών (1)' }));
  await user.click(screen.getByRole('button', { name: question.options[question.correct], exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('Όλες οι απαντήσεις σωστές!')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(container.querySelector('.DSM5-option.incorrect')).toBeTruthy();
}, 20000);
