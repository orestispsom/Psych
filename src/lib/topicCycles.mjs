export function eligibleTopicQuestions(questions = []) {
  return questions.filter(question => question && question.qualityStatus !== 'remove_candidate');
}

export function getTopicCycle(progress, topic, questions) {
  const eligible = eligibleTopicQuestions(questions);
  const validIds = new Set(eligible.map(question => String(question.id)));
  const saved = progress?.topicCycles?.[topic];
  // Existing category drafts are the only reliable evidence of prior work in
  // this particular topic. Lifetime answers from other modes are independent.
  const sourceIds = saved?.coveredQuestionIds ?? progress?.categoryDrafts?.[topic]?.lockedQuestionIds;
  const coveredIds = Array.isArray(sourceIds) ? sourceIds : [];
  const coveredQuestionIds = [...new Set(coveredIds.map(String))].filter(id => validIds.has(id));
  const covered = new Set(coveredQuestionIds);
  const legacyAnswers = progress?.categoryDrafts?.[topic]?.answers || {};
  const wrongIds = Array.isArray(saved?.wrongQuestionIds) ? saved.wrongQuestionIds : eligible.filter(question => covered.has(String(question.id)) &&
    Number.isInteger(legacyAnswers[question.id]) && legacyAnswers[question.id] !== question.correct).map(question => String(question.id));
  const remainingQuestions = eligible.filter(question => !covered.has(String(question.id)));
  return {
    round: Math.max(1, Number(saved?.round) || 1),
    coveredQuestionIds,
    wrongQuestionIds: [...new Set(wrongIds.map(String))].filter(id => covered.has(id)),
    completed: coveredQuestionIds.length,
    total: eligible.length,
    remainingQuestions,
    isComplete: eligible.length > 0 && remainingQuestions.length === 0,
    updatedAt: saved?.updatedAt || null,
  };
}

export function recordTopicCoverage(progress, topic, questionId, questions, selected) {
  const cycle = getTopicCycle(progress, topic, questions);
  if (!cycle.remainingQuestions.some(question => String(question.id) === String(questionId))) return progress;
  const now = new Date().toISOString();
  return {
    ...progress,
    topicCycles: {
      ...(progress.topicCycles || {}),
      [topic]: {
        round: cycle.round,
        coveredQuestionIds: [...cycle.coveredQuestionIds, String(questionId)],
        wrongQuestionIds: Number.isInteger(selected) && selected !== questions.find(question => String(question.id) === String(questionId)).correct
          ? [...cycle.wrongQuestionIds, String(questionId)] : cycle.wrongQuestionIds,
        updatedAt: now,
      },
    },
    updatedAt: now,
  };
}

export function startNextTopicCycle(progress, topic, questions) {
  const cycle = getTopicCycle(progress, topic, questions);
  if (!cycle.isComplete) return progress;
  const now = new Date().toISOString();
  const categoryDrafts = { ...(progress.categoryDrafts || {}) };
  delete categoryDrafts[topic];
  return {
    ...progress,
    categoryDrafts,
    topicCycles: {
      ...(progress.topicCycles || {}),
      [topic]: { round: cycle.round + 1, coveredQuestionIds: [], wrongQuestionIds: [], updatedAt: now },
    },
    updatedAt: now,
  };
}

// Union coverage within a round; an explicit newer round supersedes an older
// one so reconnecting another device cannot resurrect completed questions.
export function mergeTopicCycles(left = {}, right = {}) {
  const merged = { ...left };
  for (const [topic, local] of Object.entries(right)) {
    const remote = merged[topic];
    if (!remote || local.round > remote.round) merged[topic] = local;
    else if (local.round === remote.round) merged[topic] = {
      ...remote,
      ...local,
      coveredQuestionIds: [...new Set([...(remote.coveredQuestionIds || []), ...(local.coveredQuestionIds || [])].map(String))],
      wrongQuestionIds: [...new Set([...(remote.wrongQuestionIds || []), ...(local.wrongQuestionIds || [])].map(String))],
      updatedAt: new Date(remote.updatedAt || 0) > new Date(local.updatedAt || 0) ? remote.updatedAt : local.updatedAt,
    };
  }
  return merged;
}
