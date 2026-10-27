function normalizeVoteText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%.,/ -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMcqQualitySignals(rows, questions, getStem = question => question?.stem) {
  const questionsById = new Map(questions.map(question => [String(question.id), question]));
  const signals = {};

  for (const row of rows || []) {
    if (!row || !["quality_up", "quality_down"].includes(row.feedback_type)) continue;
    const question = questionsById.get(String(row.question_id));
    if (!question || !row.question_text_snapshot) continue;
    if (normalizeVoteText(getStem(question)) !== normalizeVoteText(row.question_text_snapshot)) continue;

    const questionId = String(question.id);
    const signal = signals[questionId] || { up: 0, down: 0 };
    if (row.feedback_type === "quality_up") signal.up += 1;
    if (row.feedback_type === "quality_down") signal.down += 1;
    signals[questionId] = signal;
  }

  return signals;
}

export function getMcqQualityPreference(question, qualitySignals = {}, mode = "study") {
  const signal = qualitySignals[String(question?.id)] || qualitySignals[question?.id] || {};
  const upvotes = Math.min(Number(signal.up) || 0, 3);
  const downvotes = Math.min(Number(signal.down) || 0, 3);
  const written = mode === "written";
  let score = upvotes * (written ? 4 : 3) - downvotes * (written ? 4 : 3);

  if (question?.qualityStatus === "good") score += written ? 10 : 5;
  else if (question?.qualityStatus === "needs_review") score -= written ? 12 : 6;
  else if (question?.qualityStatus === "needs_edit") score -= written ? 22 : 10;
  else if (question?.qualityStatus === "remove_candidate") score -= written ? 60 : 30;

  if (question?.sourceStatus === "exact") score += written ? 16 : 4;
  else if (question?.sourceStatus === "near_exact") score += written ? 8 : 2;
  else if (question?.sourceStatus === "fabricated" && written) score -= 4;

  return score;
}

export function rankQuestionsWithQuality(
  questions,
  baseScore,
  qualitySignals = {},
  { mode = "study", random = Math.random, jitter = 6 } = {}
) {
  return questions
    .map(question => ({
      question,
      score:
        (Number(baseScore(question)) || 0) +
        getMcqQualityPreference(question, qualitySignals, mode) +
        random() * jitter,
    }))
    .sort((left, right) => right.score - left.score || String(left.question.id).localeCompare(String(right.question.id)))
    .map(item => item.question);
}

function appendUnique(target, candidates, usedIds, limit) {
  for (const question of candidates) {
    if (target.length >= limit) break;
    if (!question || usedIds.has(String(question.id))) continue;
    usedIds.add(String(question.id));
    target.push(question);
    if (target.length >= limit) break;
  }
}

function blendQueues(primary, secondary, limit) {
  const blended = [];
  const usedIds = new Set();
  let primaryIndex = 0;
  let secondaryIndex = 0;

  while (blended.length < limit && (primaryIndex < primary.length || secondaryIndex < secondary.length)) {
    const preferPrimary = blended.length % 3 === 0;
    const queues = preferPrimary
      ? [[primary, "primary"], [secondary, "secondary"]]
      : [[secondary, "secondary"], [primary, "primary"]];
    let added = false;

    for (const [queue, queueName] of queues) {
      let index = queueName === "primary" ? primaryIndex : secondaryIndex;
      while (index < queue.length && usedIds.has(String(queue[index].id))) index += 1;
      if (queueName === "primary") primaryIndex = index;
      else secondaryIndex = index;
      if (index >= queue.length) continue;

      const question = queue[index];
      if (queueName === "primary") primaryIndex += 1;
      else secondaryIndex += 1;
      usedIds.add(String(question.id));
      blended.push(question);
      added = true;
      break;
    }

    if (!added) break;
  }

  return blended;
}

export function selectAdaptiveQuestionOrder({
  questions,
  count = questions.length,
  records = {},
  qualitySignals = {},
  isRecent = () => false,
  hasSeen,
  getSeenCount,
  isMastered,
  isDue,
  scoreStudy,
  scoreReview,
  random = Math.random,
}) {
  const limit = Math.min(count, questions.length);

  const getRecord = (qId) => records[qId] || records[String(qId)] || records[Number(qId)] || {};

  const shuffle = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Filter out broken or remove_candidate questions
  const eligibleQuestions = questions.filter(q => q?.qualityStatus !== "remove_candidate");

  // 1. Unseen questions (never attempted or viewed)
  const unseen = [];
  // 2. Wrong or due review questions
  const wrongOrDue = [];
  // 3. Stale / Oldest seen questions (seen >= 7 days ago or timestamp missing)
  const staleSeen = [];
  // 4. Moderate seen questions (seen 2 - 7 days ago)
  const moderateSeen = [];
  // 5. Recent seen questions (seen < 2 days ago or marked recent)
  const recentSeen = [];

  for (const q of eligibleQuestions) {
    const rec = getRecord(q.id);
    const seen = hasSeen(rec);
    const recent = isRecent(q);

    if (!seen) {
      if (!recent) unseen.push(q);
      else recentSeen.push(q);
      continue;
    }

    const wrong = (rec.wrongCount || rec.incorrectCount || 0) > 0 || rec.lastCorrect === false;
    const due = isDue ? isDue(rec) : false;

    if ((wrong || due) && !recent) {
      wrongOrDue.push(q);
      continue;
    }

    const lastTimeStr = rec.lastAnsweredAt || rec.seenAt || rec.updatedAt;
    const lastTime = lastTimeStr ? new Date(lastTimeStr).getTime() : 0;
    const daysSince = lastTime ? (now - lastTime) / oneDayMs : 999;

    if (recent || daysSince < 2) {
      recentSeen.push(q);
    } else if (daysSince >= 7) {
      staleSeen.push(q);
    } else {
      moderateSeen.push(q);
    }
  }

  const selected = [];
  const usedIds = new Set();

  // Tier 1: Fresh unseen questions (Fisher-Yates random)
  appendUnique(selected, shuffle(unseen), usedIds, limit);

  // Tier 2: Questions needing review / error remediation (Fisher-Yates random)
  appendUnique(selected, shuffle(wrongOrDue), usedIds, limit);

  // Tier 3: Questions not seen in the longest time (>= 7 days ago, Fisher-Yates random)
  appendUnique(selected, shuffle(staleSeen), usedIds, limit);

  // Tier 4: Moderate age questions (2 - 7 days ago, Fisher-Yates random)
  appendUnique(selected, shuffle(moderateSeen), usedIds, limit);

  // Tier 5: Recent questions (fallback to fill quota, Fisher-Yates random)
  appendUnique(selected, shuffle(recentSeen), usedIds, limit);

  // Final safety fallback
  appendUnique(selected, shuffle(eligibleQuestions), usedIds, limit);

  return selected;
}

// Independent exponential clocks implement weighted sampling without replacement.
// Positive weights preserve a chance for every eligible item; they are not ranks.
export function weightedQuestionOrder(questions, getWeight = () => 1, random = Math.random) {
  return questions.map(question => {
    const value = Number(getWeight(question));
    const weight = Number.isFinite(value) && value > 0 ? value : 1;
    const draw = Math.max(Number.MIN_VALUE, Math.min(1 - Number.EPSILON, random()));
    return { question, key: -Math.log(draw) / weight };
  }).sort((a, b) => a.key - b.key).map(item => item.question);
}

export function selectWrittenExamByTopic({
  eligible,
  targetCount,
  topicQuotas,
  getTopic,
  getWeight = () => 1,
  trySelect,
  getSelected,
  shuffle,
  random = Math.random,
}) {
  const byTopic = new Map();
  for (const question of weightedQuestionOrder(eligible, getWeight, random)) {
    const topic = getTopic(question);
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(question);
  }

  const pickFrom = (candidates, limit) => {
    for (const question of candidates) {
      if (getSelected().length >= targetCount || getSelected().length >= limit) break;
      trySelect(question);
    }
  };

  for (const [topic, quota] of topicQuotas) {
    pickFrom(byTopic.get(topic) || [], getSelected().length + quota);
  }

  // If deduplication exhausts a topic, fill the remaining places from the bank.
  pickFrom(weightedQuestionOrder(eligible, getWeight, random), targetCount);
  return shuffle(getSelected());
}
