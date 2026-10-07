import { describe, expect, it } from 'vitest';
import { recoverWrittenExam } from './writtenExamHistory.mjs';

const questions = [{ id: 1, options: ['a', 'b'], correct: 0 }, { id: 2, options: ['c', 'd'], correct: 1 }];
const session = { id: 'old', questionIds: [1, 2], total: 2, correct: 0, wrong: 1, unanswered: 1 };
const attempts = [{ mode: 'written', sessionId: 'old', questionId: 1, selected: 1 }];
const buildResult = (qs, answers) => {
  const items = qs.map(question => ({ question, selected: answers[question.id] }));
  const correct = items.filter(item => item.selected === item.question.correct).length;
  const unanswered = items.filter(item => item.selected === undefined).length;
  return { items, correct, unanswered, wrong: qs.length - correct - unanswered };
};
const recover = (saved = session, records = attempts, bank = questions) =>
  recoverWrittenExam(saved, records, id => bank.find(q => q.id === id), buildResult);

describe('written exam history', () => {
  it('recovers only this session and preserves unanswered questions', () => {
    const restored = recover(session, [...attempts, { ...attempts[0], sessionId: 'another', selected: 0 }]);
    expect(restored.result.items[0].selected).toBe(1);
    expect(restored.result.items[1].selected).toBeUndefined();
    expect(restored.legacy).toBe(true);
  });
  it('does not fabricate missing answers or review a changed answer key', () => {
    expect(recover(session, [])).toBeNull();
    expect(recover(session, attempts, [{ ...questions[0], correct: 1 }, questions[1]])).toBeNull();
    expect(recover(session, attempts, [questions[0]])).toBeNull();
  });
  it('uses the saved snapshot even when the bank and attempts are unavailable', () => {
    const result = buildResult(questions, { 1: 1 });
    const optionOrders = { 1: [1, 0], 2: [0, 1] };
    expect(recover({ ...session, result, optionOrders }, [], [])).toEqual({ result, optionOrders });
  });
});
