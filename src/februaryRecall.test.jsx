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

it('maps every recall entry to live questions and keeps adaptations distinct from recovered keys', () => {
  expect(coverage.rows.map(row => row.number)).toEqual(Array.from({ length: 65 }, (_, index) => index + 1));
  const liveIds = new Set(bank.map(question => question.id));
  expect(liveIds.size).toBe(bank.length);
  for (const row of coverage.rows) {
    expect(row.questionIds.length, `Recall ${row.number}`).toBeGreaterThan(0);
    for (const id of row.questionIds) expect(liveIds.has(id), `Missing question ${id}`).toBe(true);
    if (row.status.startsWith('adapted_')) expect(row.originalKeyRecovered).toBe(false);
  }
  expect(additions.map(question => question.id)).toEqual(coverage.newQuestionIds);
  for (const question of additions) {
    expect(question.sourceStatus).toBe('fabricated');
    expect(question.references.length).toBeGreaterThan(0);
    for (const number of question.recalledItemNumbers) {
      expect(coverage.rows.find(row => row.number === number).questionIds).toContain(question.id);
    }
  }
});

it('does not give new answer keys conspicuously longer wording than every distractor', () => {
  for (const question of additions) {
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
