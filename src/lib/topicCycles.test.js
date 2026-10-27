import { expect, it } from 'vitest';
import { getTopicCycle, recordTopicCoverage, startNextTopicCycle, mergeTopicCycles } from './topicCycles.mjs';
import { toRemoteMcqSessionState, mergeLegacyAndSessionProgress } from '../progressPersistence.mjs';
const questions = [{ id: 1 }, { id: 2 }, { id: 3, qualityStatus: 'remove_candidate' }];

it('uses existing submitted category answers, excluding removed and unknown questions', () => {
  const progress = { questions: { 2: { seenCount: 5, attempts: 5 } }, categoryDrafts: { topic: { lockedQuestionIds: [1, '1', 3, 99] } } };
  const cycle = getTopicCycle(progress, 'topic', questions);
  expect(cycle.completed).toBe(1);
  expect(cycle.total).toBe(2);
  expect(cycle.remainingQuestions.map(q => q.id)).toEqual([2]);
  expect(getTopicCycle(progress, 'another', questions).completed).toBe(0);
});

it('records coverage once and permits a fresh cycle only after full completion', () => {
  let progress = { questions: { 1: { attempts: 7, masteryLevel: 5 } }, bookmarks: { 1: true }, categoryDrafts: { other: { questionIds: [1] } } };
  expect(startNextTopicCycle(progress, 'topic', questions)).toBe(progress);
  progress = recordTopicCoverage(progress, 'topic', 1, questions);
  expect(recordTopicCoverage(progress, 'topic', '1', questions)).toBe(progress);
  progress = recordTopicCoverage(progress, 'topic', 2, questions);
  expect(getTopicCycle(progress, 'topic', questions).isComplete).toBe(true);
  const restarted = startNextTopicCycle(progress, 'topic', questions);
  expect(getTopicCycle(restarted, 'topic', questions)).toMatchObject({ round: 2, completed: 0, total: 2 });
  expect(restarted.questions).toEqual(progress.questions);
  expect(restarted.bookmarks).toEqual(progress.bookmarks);
  expect(restarted.categoryDrafts.other).toEqual(progress.categoryDrafts.other);
});

it('accounts for newly added questions without restarting a completed round', () => {
  const progress = { topicCycles: { topic: { round: 2, coveredQuestionIds: ['1', '2'] } } };
  expect(getTopicCycle(progress, 'topic', questions).isComplete).toBe(true);
  expect(getTopicCycle(progress, 'topic', [...questions, { id: 4 }]).remainingQuestions.map(q => q.id)).toEqual([4]);
});

it('merges coverage within a round but never restores IDs from an older round', () => {
  const remote = { topic: { round: 1, coveredQuestionIds: ['1'] }, other: { round: 1, coveredQuestionIds: ['9'] } };
  expect(mergeTopicCycles(remote, { topic: { round: 1, coveredQuestionIds: ['2'] } }).topic.coveredQuestionIds).toEqual(['1', '2']);
  expect(mergeTopicCycles(remote, { topic: { round: 2, coveredQuestionIds: [] } }).topic).toEqual({ round: 2, coveredQuestionIds: [] });
  expect(mergeTopicCycles({ topic: { round: 2, coveredQuestionIds: [] } }, remote).topic.coveredQuestionIds).toEqual([]);
});

it('includes topic memory in the existing remote session payload', () => {
  const progress = recordTopicCoverage({}, 'topic', 1, questions);
  expect(toRemoteMcqSessionState(progress).topicCycles).toEqual(progress.topicCycles);
  expect(mergeLegacyAndSessionProgress({}, { state: toRemoteMcqSessionState(progress), updated_at: progress.updatedAt }).topicCycles).toEqual(progress.topicCycles);
});

it('merges remote coverage and honours a full progress reset', () => {
  const legacy = { updatedAt: '2026-10-01T10:00:00Z', topicCycles: { topic: { round: 1, coveredQuestionIds: ['1'] } } };
  const session = { updated_at: '2026-10-01T11:00:00Z', state: { topicCycles: { topic: { round: 1, coveredQuestionIds: ['2'] } } } };
  expect(mergeLegacyAndSessionProgress(legacy, session).topicCycles.topic.coveredQuestionIds).toEqual(['1', '2']);
  expect(mergeLegacyAndSessionProgress(legacy, { ...session, state: { resetAt: session.updated_at, topicCycles: {} } }).topicCycles).toEqual({});
});
