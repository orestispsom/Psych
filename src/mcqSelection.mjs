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

  // Filter out any broken or remove_candidate questions
  const eligibleQuestions = questions.filter(q => q?.qualityStatus !== "remove_candidate");

  // 1. Unseen questions (never attempted or viewed)
  const unseen = eligibleQuestions.filter(q => !hasSeen(getRecord(q.id)));

  // 2. Questions needing review (attempted, but wrong / unmastered)
  const needsReview = eligibleQuestions.filter(q => {
    const rec = getRecord(q.id);
    return hasSeen(rec) && !isMastered(rec);
  });

  // 3. Mastered questions
  const mastered = eligibleQuestions.filter(q => {
    const rec = getRecord(q.id);
    return hasSeen(rec) && isMastered(rec);
  });

  // Shuffle pools with true Fisher-Yates randomness, separating fresh vs recent
  const unseenFresh = shuffle(unseen.filter(q => !isRecent(q)));
  const unseenRecent = shuffle(unseen.filter(q => isRecent(q)));

  const needsReviewFresh = shuffle(needsReview.filter(q => !isRecent(q)));
  const needsReviewRecent = shuffle(needsReview.filter(q => isRecent(q)));

  const masteredFresh = shuffle(mastered.filter(q => !isRecent(q)));
  const masteredRecent = shuffle(mastered.filter(q => isRecent(q)));

  const selected = [];
  const usedIds = new Set();

  // Tier 1: Fresh unseen questions (true random)
  appendUnique(selected, unseenFresh, usedIds, limit);

  // Tier 2: Fresh review questions (true random)
  appendUnique(selected, needsReviewFresh, usedIds, limit);

  // Tier 3: Fresh mastered questions (true random)
  appendUnique(selected, masteredFresh, usedIds, limit);

  // Fallbacks if user has seen almost everything:
  appendUnique(selected, unseenRecent, usedIds, limit);
  appendUnique(selected, needsReviewRecent, usedIds, limit);
  appendUnique(selected, masteredRecent, usedIds, limit);
  appendUnique(selected, shuffle(eligibleQuestions), usedIds, limit);

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
  const pickFrom = (candidates, topicLimit) => {
    for (const question of candidates) {
      if (getSelected().length >= targetCount || getSelected().length >= topicLimit) break;
      trySelect(question);
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

  return shuffle(getSelected());
}
