import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';
import coverage from '../docs/february-2026-mcq-coverage.json';

const additions = bank.filter(question => question.source === 'february_2026_recall');
const storageKey = 'psychiatry-study-profiles-v1';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/mcq/bookmarks');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('maps every recall entry to live questions while retaining the historical coverage snapshot', () => {
  expect(coverage.rows.map(row => row.number)).toEqual(Array.from({ length: 65 }, (_, index) => index + 1));
  const liveIds = new Set(bank.map(question => question.id));
  expect(liveIds.size).toBe(bank.length);
  for (const row of coverage.rows) {
    expect(row.questionIds.length, `Recall ${row.number}`).toBeGreaterThan(0);
    for (const id of row.questionIds) expect(liveIds.has(id), `Missing question ${id}`).toBe(true);
    if (row.status.startsWith('adapted_')) expect(row.originalKeyRecovered).toBe(false);
  }
  // Later source-faithful finalization added records after this audit snapshot.
  // Its original ID list remains provenance, not an exhaustive live-bank list.
  expect(additions.filter(question => coverage.newQuestionIds.includes(question.id))
    .map(question => question.id)).toEqual(coverage.newQuestionIds);
  expect([...new Set(additions.flatMap(question => question.recalledItemNumbers))]
    .sort((left, right) => left - right)).toEqual(Array.from({ length: 65 }, (_, index) => index + 1));
  for (const question of additions) {
    expect(['exact', 'near_exact', 'fabricated']).toContain(question.sourceStatus);
    for (const number of question.recalledItemNumbers) {
      expect(coverage.rows.some(row => row.number === number)).toBe(true);
    }
  }
});

it('does not give authored answer keys conspicuously longer wording than every distractor', () => {
  // Preserved source wording must not be rewritten to satisfy an authorship
  // heuristic. Explicitly finalized recalled items retain their source caveats.
  const authored = additions.filter(question => question.sourceStatus === 'fabricated' &&
    question.reviewStatus !== 'finalized_as_recalled');
  expect(authored.length).toBeGreaterThan(0);
  for (const question of authored) {
    const keyLength = question.options[question.correct].length;
    const longestDistractor = Math.max(...question.options.filter((_, index) => index !== question.correct).map(option => option.length));
    // Editorial guard, not a measure of distractor plausibility or clinical validity.
    expect(keyLength, `Length cue in question ${question.id}`).toBeLessThanOrEqual(Math.max(20, longestDistractor * 1.2));
  }
});

it.each([3335, 3355])('loads, grades and explains new question %s through bookmarked practice', async id => {
  const question = bank.find(item => item.id === id);
  const user = userEvent.setup();
  localStorage.setItem(storageKey, JSON.stringify({
    version: 1,
    activeProfileId: 'february-tester',
    profiles: {
      'february-tester': {
        id: 'february-tester', name: 'February Tester',
        mcqProgress: { bookmarks: { [id]: true }, questions: {}, attempts: [], sprintSessions: [], writtenExamSessions: [] },
      },
    },
  }));
  const { container } = render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByText(question.stem, { exact: true })).toBeInTheDocument();
  await user.click(within(container.querySelector('.options-list')).getByText(question.options[question.correct], { exact: true }));
  await user.keyboard('{Enter}');
  expect(await screen.findByText(question.explanation, { exact: true })).toBeInTheDocument();
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(saved.profiles['february-tester'].mcqProgress.questions[id].correctCount).toBe(1);
  });
}, 20000);
