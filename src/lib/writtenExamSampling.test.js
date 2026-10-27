import { describe, expect, it } from 'vitest';
import { buildWrittenExamWeights, buildWrittenTopicQuotas } from './writtenExamSampling.mjs';
import { selectWrittenExamByTopic, weightedQuestionOrder } from '../mcqSelection.mjs';
import bank from '../data/questions.js';

const now = new Date('2026-10-27T12:00:00Z');
const ago = days => new Date(now.getTime() - days * 86_400_000).toISOString();
const question = { id: 1, topic: 'a', qualityStatus: 'good', sourceStatus: 'exact' };
const weight = record => buildWrittenExamWeights([question], { questions: { 1: record } }, {}, now).get('1');
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe('bounded learning-history weights', () => {
  it('gives unseen questions no bonus over stable mastered questions', () => {
    expect(weight({})).toBe(weight({ attempts: 5, masteryLevel: 5, lastCorrect: true, lastAnsweredAt: ago(30), nextReviewAt: ago(-3) }));
    expect(weight({ seenAt: ago(0) })).toBe(weight({}));
  });

  it('modestly increases the chance of weak and due items while retaining mastered items', () => {
    const base = weight({});
    const weak = weight({ attempts: 4, masteryLevel: 1, lastCorrect: false, consecutiveWrong: 2, nextReviewAt: ago(1), lastAnsweredAt: ago(7) });
    expect(weak / base).toBeCloseTo(1.9);
    expect(weight({ attempts: 5, masteryLevel: 5, nextReviewAt: ago(1) }) / base).toBeCloseTo(1.2);
    expect(weight({ attempts: 20, masteryLevel: 5, lastCorrect: true, wrongCount: 10, confidentWrongCount: 10 })).toBe(base);
  });

  it('uses recent completed exam history after the 500-attempt buffer has rolled over', () => {
    const progress = { attempts: [], writtenExamSessions: [{ questionIds: ['1'], completedAt: ago(1) }] };
    const cooled = buildWrittenExamWeights([question], progress, {}, now).get('1');
    expect(cooled / weight({})).toBeCloseTo(0.4 + 0.6 / 14);
    progress.writtenExamSessions[0].completedAt = ago(15);
    expect(buildWrittenExamWeights([question], progress, {}, now).get('1')).toBe(weight({}));
  });

  it('takes the most recent timestamps regardless of stored order and does not stack cooling penalties', () => {
    const progress = {
      questions: { 1: { lastAnsweredAt: ago(1) } },
      attempts: [30, 1, 20].map(days => ({ questionId: 1, mode: 'written', attemptedAt: ago(days) })),
    };
    expect(buildWrittenExamWeights([question], progress, {}, now).get('1') / weight({})).toBeCloseTo(0.4 + 0.6 / 14);
  });

  it('keeps all eligible weights positive with incomplete or legacy records', () => {
    const progress = { questions: { 1: { attempts: 10, mastery_level: 5, lastAnsweredAt: 'invalid', nextReviewAt: 'invalid' } } };
    expect(buildWrittenExamWeights([question], progress, {}, now).get('1')).toBe(weight({}));
  });
});

describe('topic quotas and probabilistic selection', () => {
  it('allocates exactly 100 topic slots independently of learner mastery', () => {
    const quotas = buildWrittenTopicQuotas(bank, 100);
    expect([...quotas.values()].reduce((a, b) => a + b, 0)).toBe(100);
    expect(quotas.size).toBe(new Set(bank.map(q => q.topic)).size);
    for (const [topic, count] of quotas) expect(count).toBeLessThanOrEqual(bank.filter(q => q.topic === topic).length);
  });

  it('recalculates allocation deficits instead of sending all spare places to one topic', () => {
    const questions = ['a', 'b', 'c'].flatMap((topic, index) => Array.from({ length: 7 + index }, (_, id) => ({ id: `${topic}${id}`, topic })));
    const quotas = buildWrittenTopicQuotas(questions, 10);
    expect([...quotas.values()].reduce((a, b) => a + b, 0)).toBe(10);
    expect(Math.max(...quotas.values()) - Math.min(...quotas.values())).toBeLessThanOrEqual(1);
    expect(buildWrittenTopicQuotas([], 100).size).toBe(0);
  });

  it('samples probabilistically instead of always selecting the same highest-weight questions', () => {
    const random = seeded(42);
    const questions = [{ id: 'weak' }, { id: 'mastered' }];
    let weakFirst = 0;
    for (let i = 0; i < 10000; i++) {
      if (weightedQuestionOrder(questions, q => q.id === 'weak' ? 1.9 : 1, random)[0].id === 'weak') weakFirst++;
    }
    expect(weakFirst / 10000).toBeGreaterThan(0.62);
    expect(weakFirst / 10000).toBeLessThan(0.69);
  });

  it.each(['unseen', 'mastered', 'weak'])('fills 100 unique questions with topic quotas for an all-%s learner', scenario => {
    const random = seeded(1234);
    const progress = { questions: Object.fromEntries(bank.map(q => [q.id, scenario === 'unseen' ? {} : {
      attempts: 10, masteryLevel: scenario === 'mastered' ? 5 : 1, lastCorrect: scenario === 'mastered',
    }])) };
    const weights = buildWrittenExamWeights(bank, progress, {}, now);
    const quotas = buildWrittenTopicQuotas(bank, 100);
    const selected = [];
    const ids = new Set();
    const result = selectWrittenExamByTopic({
      eligible: bank, targetCount: 100, topicQuotas: quotas, getTopic: q => q.topic,
      getWeight: q => weights.get(String(q.id)), random, shuffle: items => items,
      getSelected: () => selected, trySelect: q => { if (ids.has(q.id)) return false; ids.add(q.id); selected.push(q); return true; },
    });
    expect(result).toHaveLength(100);
    expect(ids.size).toBe(100);
    for (const [topic, count] of quotas) expect(result.filter(q => q.topic === topic)).toHaveLength(count);
  });

  it('fills exhausted-topic places while respecting the caller’s duplicate guard', () => {
    const questions = [{ id: 1, topic: 'a' }, ...Array.from({ length: 5 }, (_, i) => ({ id: i + 2, topic: 'b' }))];
    const selected = [];
    const result = selectWrittenExamByTopic({
      eligible: questions, targetCount: 4, topicQuotas: new Map([['a', 2], ['b', 2]]),
      getTopic: q => q.topic, getSelected: () => selected, random: seeded(3), shuffle: items => items,
      trySelect: q => { if (selected.includes(q)) return false; selected.push(q); return true; },
    });
    expect(new Set(result.map(q => q.id)).size).toBe(4);
  });
});
