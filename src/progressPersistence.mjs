const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampValue(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getQuestionRecordTimestamp(record = {}) {
  return record.updatedAt || record.lastAnsweredAt || record.seenAt || null;
}

export function toRemoteMcqSessionState(progress = {}) {
  const {
    questions: _questions,
    attempts: _attempts,
    updatedAt: _highFrequencyUpdatedAt,
    ...sessionState
  } = progress || {};

  return sessionState;
}

export function sessionStateFingerprint(progress = {}) {
  return JSON.stringify(toRemoteMcqSessionState(progress));
}

export function mergeLegacyAndSessionProgress(legacyProgress = {}, sessionRow = null) {
  const legacy = legacyProgress && typeof legacyProgress === "object" ? legacyProgress : {};
  const sessionState = sessionRow?.state && typeof sessionRow.state === "object"
    ? sessionRow.state
    : null;
  if (!sessionState) return legacy;

  const legacyUpdatedAt = timestampValue(legacy.updatedAt);
  const sessionUpdatedAt = timestampValue(sessionRow.updated_at || sessionState.updatedAt);
  const preferSessionState = sessionUpdatedAt >= legacyUpdatedAt;
  const lowFrequencyState = preferSessionState
    ? sessionState
    : toRemoteMcqSessionState(legacy);
  const merged = { ...legacy, ...lowFrequencyState };
  const resetAt = timestampValue(lowFrequencyState.resetAt);

  if (resetAt && resetAt >= legacyUpdatedAt) {
    merged.questions = {};
    merged.attempts = [];
  }

  return merged;
}

export function getChangedQuestionIds(previousProgress = {}, nextProgress = {}) {
  const previous = previousProgress.questions || {};
  const next = nextProgress.questions || {};
  const ids = new Set([...Object.keys(previous), ...Object.keys(next)]);

  return [...ids].filter(id => JSON.stringify(previous[id]) !== JSON.stringify(next[id]));
}

export function questionStateToRemoteRow(profileId, questionId, state = {}, resetAt = null) {
  const correctCount = numberOr(state.correctCount);
  const wrongCount = numberOr(state.wrongCount ?? state.incorrectCount);
  const attempts = Math.max(numberOr(state.attempts), correctCount + wrongCount);
  const seenCount = Math.max(numberOr(state.seenCount), attempts, state.seenAt ? 1 : 0);
  const masteryLevel = numberOr(state.masteryLevel ?? state.mastery_level);

  return {
    profile_id: profileId,
    question_id: String(questionId),
    progress_reset_at: resetAt || null,
    seen_count: seenCount,
    correct_count: correctCount,
    wrong_count: wrongCount,
    consecutive_correct: numberOr(state.consecutiveCorrect ?? state.streak),
    consecutive_wrong: numberOr(state.consecutiveWrong),
    mastery_level: Math.min(5, Math.max(0, masteryLevel)),
    first_seen_at: state.seenAt || null,
    last_seen_at: state.seenAt || null,
    last_answered_at: state.lastAnsweredAt || null,
    next_review_at: state.nextReviewAt || null,
    last_answer_correct: state.lastCorrect ?? null,
    last_selected: nullableNumber(state.lastSelected),
    last_confidence: nullableNumber(state.lastConfidence),
    last_time_taken_ms: nullableNumber(state.lastTimeTakenMs),
    last_points_awarded: numberOr(state.lastPointsAwarded),
    confident_wrong_count: numberOr(state.confidentWrongCount),
    average_time_ms: nullableNumber(state.averageTimeMs),
    total_points: numberOr(state.totalPoints),
    updated_at: getQuestionRecordTimestamp(state) || new Date().toISOString(),
  };
}

export function remoteQuestionStateToRecord(row = {}) {
  const correctCount = numberOr(row.correct_count);
  const wrongCount = numberOr(row.wrong_count);
  const masteryLevel = numberOr(row.mastery_level);
  const firstSeenAt = row.first_seen_at || row.last_seen_at || row.updated_at || null;

  const record = {
    seenAt: firstSeenAt,
    lastPointsAwarded: numberOr(row.last_points_awarded),
    attempts: correctCount + wrongCount,
    seenCount: numberOr(row.seen_count, correctCount + wrongCount),
    correctCount,
    incorrectCount: wrongCount,
    wrongCount,
    streak: numberOr(row.consecutive_correct),
    consecutiveCorrect: numberOr(row.consecutive_correct),
    consecutiveWrong: numberOr(row.consecutive_wrong),
    confidentWrongCount: numberOr(row.confident_wrong_count),
    masteryLevel,
    mastery_level: masteryLevel,
    mastered: masteryLevel === 5,
    nextReviewAt: row.next_review_at || null,
    averageTimeMs: nullableNumber(row.average_time_ms),
    totalPoints: numberOr(row.total_points),
    updatedAt: row.updated_at || null,
  };

  if (row.last_answered_at) record.lastAnsweredAt = row.last_answered_at;
  if (row.last_selected !== null && row.last_selected !== undefined) record.lastSelected = numberOr(row.last_selected);
  if (row.last_answer_correct !== null && row.last_answer_correct !== undefined) record.lastCorrect = row.last_answer_correct;
  if (row.last_confidence !== null && row.last_confidence !== undefined) record.lastConfidence = numberOr(row.last_confidence);
  if (row.last_time_taken_ms !== null && row.last_time_taken_ms !== undefined) record.lastTimeTakenMs = numberOr(row.last_time_taken_ms);

  return record;
}

export function attemptToRemoteRow(profileId, attempt = {}) {
  return {
    client_attempt_id: String(attempt.id),
    profile_id: profileId,
    question_id: String(attempt.questionId),
    client_session_id: attempt.sessionId || null,
    mode: attempt.mode,
    selected_index: nullableNumber(attempt.selected),
    selected_option: attempt.selectedOption || null,
    is_correct: Boolean(attempt.isCorrect),
    confidence: nullableNumber(attempt.confidence),
    time_taken_ms: nullableNumber(attempt.timeTakenMs),
    point_breakdown: attempt.pointBreakdown || null,
    points_awarded: numberOr(attempt.pointsAwarded),
    streak_position: numberOr(attempt.streakPosition),
    attempted_at: attempt.attemptedAt || new Date().toISOString(),
  };
}

export function remoteAttemptToRecord(row = {}) {
  const selectedIndex = nullableNumber(row.selected_index);
  const selectedOption = row.selected_option || (selectedIndex === null ? null : OPTION_LETTERS[selectedIndex]);

  return {
    id: row.client_attempt_id || `remote-${row.id}`,
    sessionId: row.client_session_id || null,
    mode: row.mode,
    questionId: numberOr(row.question_id, row.question_id),
    selected: selectedIndex === null ? OPTION_LETTERS.indexOf(selectedOption) : selectedIndex,
    selectedOption,
    isCorrect: Boolean(row.is_correct),
    confidence: nullableNumber(row.confidence),
    timeTakenMs: nullableNumber(row.time_taken_ms),
    pointsAwarded: numberOr(row.points_awarded),
    pointBreakdown: row.point_breakdown || null,
    streakPosition: numberOr(row.streak_position),
    attemptedAt: row.attempted_at,
  };
}

export function mergeAttemptRows(localAttempts = [], remoteRows = [], limit = 500, afterTimestamp = null) {
  const attemptsById = new Map();
  localAttempts.forEach(attempt => attemptsById.set(String(attempt.id), attempt));
  remoteRows.forEach(row => {
    const attempt = remoteAttemptToRecord(row);
    attemptsById.set(String(attempt.id), attempt);
  });

  const minimumTimestamp = timestampValue(afterTimestamp);
  return [...attemptsById.values()]
    .filter(attempt => !minimumTimestamp || timestampValue(attempt.attemptedAt) > minimumTimestamp)
    .sort((a, b) => timestampValue(b.attemptedAt) - timestampValue(a.attemptedAt))
    .slice(0, limit);
}
