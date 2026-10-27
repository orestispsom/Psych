import { beforeEach, afterEach, expect, it } from 'vitest';
import { render, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';

const storageKey = 'psychiatry-study-profiles-v1';
const topic = bank[0].topic;
const topicQuestions = bank.filter(question => question.topic === topic && question.qualityStatus !== 'remove_candidate');
const profile = () => JSON.parse(localStorage.getItem(storageKey)).profiles.tester;
const mount = () => render(<BrowserRouter><App /></BrowserRouter>);
beforeEach(() => { localStorage.clear(); window.history.pushState({}, '', '/mcq/category'); });
afterEach(() => { cleanup(); localStorage.clear(); });
function seed(progress = {}) {
  localStorage.setItem(storageKey, JSON.stringify({ version: 1, activeProfileId: 'tester', profiles: {
    tester: { id: 'tester', name: 'TopicTester', mcqProgress: progress, oralProgress: {}, sosProgress: {} },
  } }));
}
async function openTopic(user, container) {
  await waitFor(() => expect(container.querySelector('.mcq-select .items')).toBeTruthy());
  const button = [...container.querySelectorAll('.mcq-select .item')].find(button => button.querySelector('.item-title').textContent === topic);
  await user.click(button);
}
function displayedQuestion(container) {
  const id = Number(container.querySelector('.mcq-q-id').textContent.replace('#', ''));
  return bank.find(question => question.id === id);
}
async function answer(user, container) {
  const question = displayedQuestion(container);
  await user.click(within(container.querySelector('.options-list')).getByText(question.options[question.correct], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  return question.id;
}

it('preserves a legacy draft on cold load, excludes prior answers, and starts a new round without resetting mastery', async () => {
  const user = userEvent.setup();
  const covered = topicQuestions.slice(0, -2).map(question => question.id);
  const remaining = topicQuestions.slice(-2);
  seed({
    questions: { 1: { attempts: 8, correctCount: 8, masteryLevel: 5, mastered: true } },
    categoryDrafts: { [topic]: {
      topic, sessionId: 'legacy', questionIds: topicQuestions.map(question => question.id),
      currentIdx: 0, lockedQuestionIds: covered, answers: {},
    } },
  });
  const view = mount();
  await openTopic(user, view.container);
  expect(await screen.findByText(new RegExp(`${covered.length}/${topicQuestions.length} απαντημένες`))).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Συνέχεια από την ερώτηση 1/ }));
  expect(remaining.map(q => q.id)).toContain(displayedQuestion(view.container).id);
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toHaveLength(covered.length);
  await answer(user, view.container);
  await user.click(screen.getByRole('button', { name: 'Επόμενη ερώτηση' }));
  await answer(user, view.container);
  expect(await screen.findByText('Ο κύκλος 1 ολοκληρώθηκε')).toBeInTheDocument();
  const lifetime = structuredClone(profile().mcqProgress.questions);
  await user.click(screen.getByRole('button', { name: 'Έναρξη επόμενου κύκλου' }));
  await waitFor(() => expect(view.container.querySelector('.category-cycle-status').textContent).toContain(`0/${topicQuestions.length}`));
  expect(profile().mcqProgress.topicCycles[topic].round).toBe(2);
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toEqual([]);
  expect(profile().mcqProgress.questions[1].attempts).toBe(lifetime[1].attempts);
  expect(profile().mcqProgress.questions[1].masteryLevel).toBe(5);
}, 20000);

it('retains mistakes from a completed topic round after reload', async () => {
  const user = userEvent.setup();
  const lastQuestion = topicQuestions.at(-1);
  seed({ topicCycles: { [topic]: {
    round: 1, coveredQuestionIds: topicQuestions.slice(0, -1).map(q => String(q.id)), wrongQuestionIds: [],
  } } });
  let view = mount();
  await openTopic(user, view.container);
  await user.click(screen.getByRole('button', { name: 'Όλες οι υπόλοιπες' }));
  await waitFor(() => expect(view.container.querySelector('.mcq-q-id')).toBeTruthy());
  await user.click(within(view.container.querySelector('.options-list')).getByText(lastQuestion.options[(lastQuestion.correct + 1) % lastQuestion.options.length], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  await screen.findByText('Ο κύκλος 1 ολοκληρώθηκε');
  view.unmount();
  window.history.pushState({}, '', '/mcq/category');
  view = mount();
  await openTopic(user, view.container);
  await user.click(await screen.findByRole('button', { name: 'Εξάσκηση μόνο των λαθών (1)' }));
  expect(view.container.querySelector('.question-stem').textContent).toBe(lastQuestion.stem);
  await user.click(within(view.container.querySelector('.options-list')).getByText(lastQuestion.options[lastQuestion.correct], { exact: true }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(await screen.findByText('Ο κύκλος 1 ολοκληρώθηκε')).toBeInTheDocument();
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toHaveLength(topicQuestions.length);
}, 20000);

it('counts only submitted answers and restores the remaining queue after leaving and reloading', async () => {
  const user = userEvent.setup();
  seed();
  let view = mount();
  await openTopic(user, view.container);
  await waitFor(() => expect(view.container.querySelector('.category-cycle-status')).toBeTruthy());
  await user.click(screen.getByRole('button', { name: 'Όλες οι υπόλοιπες' }));
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toEqual([]);
  const firstId = await answer(user, view.container);
  await user.click(screen.getByRole('button', { name: 'Επόμενη ερώτηση' }));
  const nextId = displayedQuestion(view.container).id;
  // Looking at the next question leaves it available for the next sitting.
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toEqual([String(firstId)]);
  view.unmount();
  window.history.pushState({}, '', '/mcq/category');
  view = mount();
  await waitFor(() => expect(screen.getByRole('progressbar', { name: `Κάλυψη κύκλου: ${topic}` })).toHaveAttribute('aria-valuenow', '1'));
  await openTopic(user, view.container);
  await user.click(await screen.findByRole('button', { name: /Συνέχεια από την ερώτηση/ }));
  expect(displayedQuestion(view.container).id).toBe(nextId);
  expect(view.container.querySelector('.mcq-q-index').textContent).toContain(String(topicQuestions.length - 1));
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds).not.toContain(firstId);
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο Μενού MCQ' }));
  await openTopic(user, view.container);
  await user.click(await screen.findByRole('button', { name: 'Όλες οι υπόλοιπες' }));
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds).not.toContain(firstId);
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toEqual([String(firstId)]);
}, 20000);


it('opens categories before choosing size, completes chunks without repeats, and remembers the chosen size on reload', async () => {
  const user = userEvent.setup();
  seed();
  window.history.pushState({}, '', '/mcq');
  let view = mount();
  await user.click(await screen.findByRole('button', { name: /Ερωτήσεις ανά Κατηγορία/ }));
  expect(screen.queryByText('Πόσες ερωτήσεις θέλεις να απαντήσεις;')).not.toBeInTheDocument();
  await openTopic(user, view.container);
  expect(screen.getByText('Πόσες ερωτήσεις θέλεις να απαντήσεις;')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '25 ερωτήσεις' }));
  const covered = [];
  for (let index = 0; index < 25; index++) {
    covered.push(await answer(user, view.container));
    if (index < 24) await user.click(screen.getByRole('button', { name: 'Επόμενη ερώτηση' }));
  }
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toHaveLength(25);
  await user.click(screen.getByRole('button', { name: 'Επόμενες 25 ερωτήσεις' }));
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds).toHaveLength(25);
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds.some(id => covered.includes(id))).toBe(false);
  await answer(user, view.container);
  view.unmount();
  window.history.pushState({}, '', '/mcq/category');
  view = mount();
  await openTopic(user, view.container);
  expect(screen.getByText(new RegExp(`26/${topicQuestions.length} απαντημένες`))).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Συνέχεια από την ερώτηση/ }));
  expect(profile().mcqProgress.categoryDrafts[topic].chunkSize).toBe(25);
  expect(view.container.querySelector('.mcq-q-index').textContent).toContain('24');
}, 30000);

it('keeps category memory independent and resets only the selected category with confirmation', async () => {
  const user = userEvent.setup();
  const otherTopic = bank.find(q => q.topic !== topic).topic;
  const otherQuestion = bank.find(q => q.topic === otherTopic);
  const otherCycle = { round: 3, coveredQuestionIds: [String(otherQuestion.id)], wrongQuestionIds: [] };
  seed({ questions: { 1: { attempts: 7, masteryLevel: 5 } }, bookmarks: { 1: true }, topicCycles: {
    [topic]: { round: 1, coveredQuestionIds: [String(topicQuestions[0].id)] }, [otherTopic]: otherCycle,
  } });
  const view = mount();
  await openTopic(user, view.container);
  await user.click(screen.getByRole('button', { name: 'Μηδενισμός μνήμης κατηγορίας' }));
  await user.click(screen.getByRole('button', { name: 'Άκυρο' }));
  expect(profile().mcqProgress.topicCycles[topic].coveredQuestionIds).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Μηδενισμός μνήμης κατηγορίας' }));
  await user.click(screen.getByRole('button', { name: 'Μηδενισμός και νέα ομάδα' }));
  expect(profile().mcqProgress.topicCycles[topic]).toMatchObject({ round: 2, coveredQuestionIds: [] });
  expect(profile().mcqProgress.topicCycles[otherTopic]).toEqual(otherCycle);
  expect(profile().mcqProgress.questions[1]).toMatchObject({ attempts: 7, masteryLevel: 5 });
  expect(profile().mcqProgress.bookmarks[1]).toBe(true);
  expect(profile().mcqProgress.categoryDrafts[topic].round).toBe(2);
}, 20000);

it('caps the final chunk and offers a fresh round after all remaining questions are submitted', async () => {
  const user = userEvent.setup();
  seed({ topicCycles: { [topic]: { round: 1, coveredQuestionIds: topicQuestions.slice(0, -2).map(q => String(q.id)) } } });
  const view = mount();
  await openTopic(user, view.container);
  await user.click(screen.getByRole('button', { name: '25 ερωτήσεις' }));
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds).toHaveLength(2);
  await answer(user, view.container);
  await user.click(screen.getByRole('button', { name: 'Επόμενη ερώτηση' }));
  await answer(user, view.container);
  expect(await screen.findByText('Ο κύκλος 1 ολοκληρώθηκε')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Έναρξη επόμενου κύκλου' }));
  expect(profile().mcqProgress.categoryDrafts[topic].questionIds).toHaveLength(25);
  expect(profile().mcqProgress.topicCycles[topic].round).toBe(2);
}, 20000);
