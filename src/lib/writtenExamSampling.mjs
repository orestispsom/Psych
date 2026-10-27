import { WRITTEN_EXAM_BLUEPRINT, getWrittenExamTopic } from "../data/writtenExamTopics.mjs";
import { getMcqQualityPreference } from '../mcqSelection.mjs';

const DAY = 86_400_000;
const timestamp = value => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

// These are bounded product heuristics, not calibrated difficulty estimates or
// an official exam blueprint. Unanswered questions receive no novelty bonus.
export function buildWrittenExamWeights(questions, progress = {}, qualitySignals = {}, now = Date.now()) {
  const nowMs = new Date(now).getTime();
  const writtenAt = new Map();
  const answeredAt = new Map();
  const remember = (map, id, value) => {
    const time = timestamp(value);
    if (time !== null) map.set(String(id), Math.max(map.get(String(id)) ?? -Infinity, time));
  };
  for (const attempt of progress.attempts || []) {
    remember(answeredAt, attempt.questionId, attempt.attemptedAt);
    if (attempt.mode === 'written') remember(writtenAt, attempt.questionId, attempt.attemptedAt);
  }
  // The attempt list is capped at 500. Completed exam history survives that cap.
  for (const session of progress.writtenExamSessions || []) {
    if (!session.completedAt) continue;
    for (const id of session.questionIds || []) remember(writtenAt, id, session.completedAt);
  }

  const age = time => time === null || time === undefined ? null : Math.max(0, (nowMs - time) / DAY);
  return new Map(questions.map(question => {
    const id = String(question.id);
    const record = progress.questions?.[id] || {};
    const attempts = Math.max(Number(record.attempts) || 0,
      (Number(record.correctCount) || 0) + (Number(record.wrongCount ?? record.incorrectCount) || 0));
    const mastery = record.masteryLevel ?? record.mastery_level ??
      (record.mastered ? 5 : record.lastCorrect === false ? 1 : 3);
    let learningWeight = 1;
    if (attempts > 0) {
      if (mastery <= 2) learningWeight += 0.35;
      if (record.lastCorrect === false) learningWeight += 0.35;
      if ((record.consecutiveWrong ?? record.consecutive_wrong ?? 0) >= 2) learningWeight += 0.2;
      const dueAt = timestamp(record.nextReviewAt);
      if (dueAt !== null && dueAt <= nowMs) learningWeight += 0.2;
    }
    learningWeight = Math.min(1.9, learningWeight);

    const answerTime = Math.max(timestamp(record.lastAnsweredAt) ?? -Infinity, answeredAt.get(id) ?? -Infinity);
    const answerAge = age(Number.isFinite(answerTime) ? answerTime : null);
    const writtenAge = age(writtenAt.get(id));
    // Use one cooling factor, not stacked penalties. Merely opening an item
    // does not count as successful retrieval and therefore does not cool it.
    const answerCooling = answerAge === null ? 1 : 0.7 + 0.3 * Math.min(answerAge / 7, 1);
    const writtenCooling = writtenAge === null ? 1 : 0.4 + 0.6 * Math.min(writtenAge / 14, 1);
    const quality = Math.max(0.5, Math.min(1.5, 1 + getMcqQualityPreference(question, qualitySignals, 'written') / 80));
    return [id, learningWeight * Math.min(answerCooling, writtenCooling) * quality];
  }));
}

export function buildWrittenTopicQuotas(eligible, targetCount, getTopic = getWrittenExamTopic, blueprint = WRITTEN_EXAM_BLUEPRINT) {
  const counts = new Map();
  eligible.forEach(question => counts.set(getTopic(question), (counts.get(getTopic(question)) || 0) + 1));
  const target = Math.min(Math.max(0, Math.floor(targetCount)), eligible.length);
  const blueprintTotal = Object.values(blueprint).reduce((sum, count) => sum + count, 0);
  const rows = Object.entries(blueprint).map(([topic, count]) => {
    const raw = count / blueprintTotal * target;
    const cap = counts.get(topic) || 0;
    return { topic, raw, cap, quota: Math.min(cap, Math.floor(raw)) };
  });
  let total = rows.reduce((sum, row) => sum + row.quota, 0);
  while (total < target) {
    const row = rows.filter(row => row.quota < row.cap).sort((a, b) => (b.raw - b.quota) - (a.raw - a.quota))[0];
    if (!row) break;
    row.quota++;
    total++;
  }
  return new Map(rows.filter(row => row.quota > 0).map(row => [row.topic, row.quota]));
}
