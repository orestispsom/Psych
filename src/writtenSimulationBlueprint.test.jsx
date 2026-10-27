import { afterEach, expect, it } from 'vitest';
import { cleanup, render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';
import bank from './data/questions.js';
import { WRITTEN_EXAM_BLUEPRINT, getWrittenExamTopic } from './data/writtenExamTopics.mjs';

const key = 'psychiatry-study-profiles-v1';
const read = () => JSON.parse(localStorage.getItem(key)).profiles.tester.mcqProgress;
const mount = () => render(<BrowserRouter><App /></BrowserRouter>);
afterEach(() => { cleanup(); localStorage.clear(); });

it('resumes a pre-change simulation without replacing its saved question order', async () => {
  const user = userEvent.setup();
  localStorage.clear();
  window.history.replaceState({}, '', '/mcq/written');
  const ids = bank.slice(0, 100).map(q => q.id);
  localStorage.setItem(key, JSON.stringify({ version: 1, activeProfileId: 'tester', profiles: { tester: {
    id: 'tester', name: 'Legacy draft QA', mcqProgress: { writtenExamDraft: {
      sessionId: 'old-simulation', questionIds: ids, currentIdx: 7, answers: {}, optionOrders: {},
      startedAt: '2026-10-01T12:00:00Z',
    } },
  } } }));
  const view = mount();
  await user.click(await screen.findByRole('button', { name: /Συνέχεια αποθηκευμένης εξέτασης/ }));
  expect(read().writtenExamDraft.questionIds).toEqual(ids);
  expect(view.container.querySelector('.mcq-q-index')).toHaveTextContent('8 / 100');
}, 20000);

it.each(['unseen', 'familiar', 'mastered'])('generates distinct 100-question papers with approved quotas for an all-%s profile', async scenario => {
  const generated = [];
  for (let run = 0; run < 3; run++) {
    localStorage.clear();
    window.history.replaceState({}, '', '/mcq/written');
    localStorage.setItem(key, JSON.stringify({ version: 1, activeProfileId: 'tester', profiles: {
      tester: { id: 'tester', name: 'Blueprint QA', mcqProgress: { questions: scenario === 'unseen' ? {} :
        Object.fromEntries(bank.map(q => [q.id, { attempts: 5, masteryLevel: scenario === 'mastered' ? 5 : 2, lastCorrect: scenario === 'mastered' }])) },
      },
    } }));
    const view = mount();
    await waitFor(() => expect(read().writtenExamDraft?.questionIds).toHaveLength(100));
    const ids = read().writtenExamDraft.questionIds;
    expect(new Set(ids).size).toBe(100);
    const counts = {};
    for (const id of ids) {
      const topic = getWrittenExamTopic(bank.find(q => q.id === id));
      counts[topic] = (counts[topic] || 0) + 1;
    }
    expect(counts).toEqual(WRITTEN_EXAM_BLUEPRINT);
    expect(view.container.querySelector('.mcq-q-index')).toHaveTextContent('1 / 100');
    expect(view.container.querySelector('.explanation-box')).toBeNull();
    generated.push([...ids].sort((a, b) => a - b).join(','));
    view.unmount();
  }
  expect(new Set(generated).size).toBe(3);
}, 30000);

