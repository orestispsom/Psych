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
  let score = upvotes * (written ? 30 : 20) - downvotes * (written ? 24 : 18);

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
  hasSeen,
  getSeenCount,
  isMastered,
  isDue,
  scoreStudy,
  scoreReview,
  random = Math.random,
}) {
  const limit = Math.min(count, questions.length);
  const unseen = rankQuestionsWithQuality(
    questions.filter(question => !hasSeen(records[question.id])),
    () => 0,
    qualitySignals,
    { random, jitter: 5 }
  );
  const lightlySeen = rankQuestionsWithQuality(
    questions.filter(question => {
      const record = records[question.id];
      return hasSeen(record) && getSeenCount(record) <= 1 && !isMastered(record);
    }),
    scoreStudy,
    qualitySignals,
    { random, jitter: 5 }
  );
  const review = rankQuestionsWithQuality(
    questions.filter(question => Number.isFinite(scoreReview(question))),
    scoreReview,
    qualitySignals,
    { random, jitter: 4 }
  );
  const broadReview = rankQuestionsWithQuality(
    questions.filter(question => hasSeen(records[question.id])),
    question => scoreStudy(question) + (isDue(records[question.id]) ? 10 : 0),
    qualitySignals,
    { random, jitter: 8 }
  );
  const selected = [];
  const usedIds = new Set();

  appendUnique(selected, unseen, usedIds, limit);
  appendUnique(selected, lightlySeen, usedIds, limit);
  appendUnique(selected, blendQueues(review, broadReview, questions.length), usedIds, limit);
  appendUnique(
    selected,
    rankQuestionsWithQuality(questions, scoreStudy, qualitySignals, { random, jitter: 10 }),
    usedIds,
    limit
  );

  return selected;
}

export function selectWrittenExamByTopic({
  eligible,
  targetCount,
  topicQuotas,
  getTopic,
  scoreQuestion,
  isRecent,
  trySelect,
  getSelected,
  shuffle,
}) {
  const rank = questions => questions
    .map(question => ({ question, score: scoreQuestion(question) }))
    .sort((left, right) => right.score - left.score || String(left.question.id).localeCompare(String(right.question.id)))
    .map(item => item.question);
  const pickFrom = (candidates, topicLimit, options = {}) => {
    for (const question of candidates) {
      if (getSelected().length >= targetCount || getSelected().length >= topicLimit) break;
      trySelect(question, options);
    }
  };

  for (const [topic, quota] of topicQuotas) {
    const topicLimit = getSelected().length + quota;
    const topicQuestions = eligible.filter(question => getTopic(question) === topic);

    pickFrom(rank(topicQuestions.filter(question => !isRecent(question))), topicLimit);
    pickFrom(rank(topicQuestions), topicLimit);
  }

  pickFrom(rank(eligible.filter(question => !isRecent(question))), targetCount);
  pickFrom(rank(eligible), targetCount);
  pickFrom(rank(eligible), targetCount, { respectConceptCaps: false });

  return shuffle(getSelected());
}
