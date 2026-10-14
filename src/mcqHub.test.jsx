import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/mcq'); });
afterEach(() => { cleanup(); localStorage.clear(); });
function boot(progress = {}) {
  localStorage.setItem('psychiatry-study-profiles-v1', JSON.stringify({
    version: 1, activeProfileId: 'tester', profiles: {
      tester: { id: 'tester', name: 'HubTester', mcqProgress: progress },
    },
  }));
  return render(<BrowserRouter><App /></BrowserRouter>);
}
const wrongQuestions = bank.filter(q => q.qualityStatus !== 'remove_candidate').slice(0, 110);
const wrongProgress = () => ({ questions: Object.fromEntries(wrongQuestions.map(q => [q.id, {
  attempts: 1, correctCount: 0, wrongCount: 1, consecutiveWrong: 1, seenCount: 1, masteryLevel: 0,
}])) });

it('orders the seven cards and explains delayed exam feedback', async () => {
  const { container } = boot();
  await screen.findByText('Επανάληψη λαθών');
  expect([...container.querySelectorAll('.mode-tile-title')].map(el => el.textContent)).toEqual([
    'Mini-test', 'Επανάληψη λαθών', 'Ερωτήσεις ανά Κατηγορία', 'Σημειωμένες Ερωτήσεις',
    'Προσομοίωση Εξετάσεων', 'Vignettes', 'Αντιστοίχηση',
  ]);
  expect(container.querySelector('.mode-tile-exam')).toHaveTextContent('Οι απαντήσεις αποκαλύπτονται μόνο στο τέλος');
  expect(container.querySelectorAll('.mode-tile-clinical')).toHaveLength(2);
});

it.each([10, 25, 50, 100])('starts error review with %i previously wrong questions', async count => {
  const user = userEvent.setup();
  const { container } = boot(wrongProgress());
  await user.click(await screen.findByText('Επανάληψη λαθών'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByRole('button')).toHaveLength(5);
  await user.click(within(dialog).getByRole('button', { name: `${count} ερωτήσεις` }));
  await waitFor(() => expect(container.querySelector('.mcq-q-index')).toHaveTextContent(`1 / ${count}`));
  expect(window.location.search).toBe(`?count=${count}`);
  const id = Number(container.querySelector('.mcq-q-id').textContent.replace('#', ''));
  expect(wrongQuestions.some(q => q.id === id)).toBe(true);
});

it.each([10, 25, 50, 'all'])('limits category sessions to %s', async count => {
  const user = userEvent.setup();
  const { container } = boot();
  await user.click(await screen.findByText('Ερωτήσεις ανά Κατηγορία'));
  await user.click(screen.getByRole('button', { name: count === 'all' ? 'Όλες οι ερωτήσεις' : `${count} ερωτήσεις` }));
  await waitFor(() => expect(container.querySelector('.mcq-select .items .item:not([disabled])')).toBeTruthy());
  const topicButton = container.querySelector('.mcq-select .items .item:not([disabled])');
  const available = Number(topicButton.querySelector('.item-meta').textContent.match(/\d+/)[0]);
  await user.click(topicButton);
  await waitFor(() => expect(container.querySelector('.mcq-q-index')).toHaveTextContent(`1 / ${count === 'all' ? available : Math.min(count, available)}`));
  expect(window.location.search).toBe(`?count=${count}`);
});

it('keeps a new profile error review empty instead of filling it with unseen questions', async () => {
  const user = userEvent.setup();
  const { container } = boot();
  await user.click(await screen.findByText('Επανάληψη λαθών'));
  await user.click(screen.getByRole('button', { name: '100 ερωτήσεις' }));
  expect(await screen.findByText('Δεν υπάρχουν ακόμη ερωτήσεις σε αυτή τη λειτουργία')).toBeInTheDocument();
  expect(container.querySelector('.question-stem')).toBeNull();
});
