import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import QUESTIONS from "./data/questions.js";
import oralData from "./data/oral.js";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RANDOM QUESTION SELECTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function selectRandomQuestions(count) {
  const arr = [...QUESTIONS];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.slice(0, Math.min(count, arr.length));
}

const MCQ_PROGRESS_STORAGE_KEY = "psychiatry-mcq-progress-v1";
const PROFILE_STORAGE_KEY = "psychiatry-study-profiles-v1";
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const ONLINE_PROFILES_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SUPABASE_PROFILE_TABLE = "study_profiles";
const MASTERY_STREAK_TARGET = 3;
const DAILY_CHALLENGE_SIZE = 10;
const SPRINT_SESSION_SIZE = 10;
const WEAKNESS_SESSION_SIZE = 15;
const SPRINT_TIME_LIMIT_MS = 30000;
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

function createEmptyMcqProgress() {
  return {
    version: 2,
    questions: {},
    attempts: [],
    dailyChallenges: {},
    sprintSessions: [],
    updatedAt: null,
  };
}

function createResetMcqProgress() {
  const now = new Date().toISOString();
  return { ...createEmptyMcqProgress(), resetAt: now, updatedAt: now };
}

function normalizeMcqProgress(progress) {
  const empty = createEmptyMcqProgress();
  if (!progress || typeof progress !== "object") return empty;

  return {
    ...empty,
    ...progress,
    version: 2,
    questions: progress.questions && typeof progress.questions === "object" ? progress.questions : {},
    attempts: Array.isArray(progress.attempts) ? progress.attempts : [],
    dailyChallenges: progress.dailyChallenges && typeof progress.dailyChallenges === "object" ? progress.dailyChallenges : {},
    sprintSessions: Array.isArray(progress.sprintSessions) ? progress.sprintSessions : [],
  };
}

function loadMcqProgress() {
  if (typeof window === "undefined") return createEmptyMcqProgress();

  try {
    const raw = window.localStorage.getItem(MCQ_PROGRESS_STORAGE_KEY);
    if (!raw) return createEmptyMcqProgress();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.questions !== "object") {
      return createEmptyMcqProgress();
    }

    return normalizeMcqProgress(parsed);
  } catch {
    return createEmptyMcqProgress();
  }
}

function saveMcqProgress(progress) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MCQ_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage errors so study mode remains usable in private browsing.
  }
}

function createEmptyProfileStore() {
  return { version: 1, activeProfileId: null, profiles: {} };
}

function normalizeProfileName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function getProfileId(name) {
  return normalizeProfileName(name).toLocaleLowerCase();
}

function createStudyProfile(name, mcqProgress = createEmptyMcqProgress()) {
  const displayName = normalizeProfileName(name);
  return {
    id: getProfileId(displayName),
    name: displayName,
    createdAt: new Date().toISOString(),
    mcqProgress: normalizeMcqProgress(mcqProgress),
  };
}

function loadProfileStore() {
  if (typeof window === "undefined") return createEmptyProfileStore();

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createEmptyProfileStore();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.profiles !== "object") {
      return createEmptyProfileStore();
    }

    const profiles = Object.fromEntries(
      Object.entries(parsed.profiles)
        .filter(([, profile]) => profile && typeof profile === "object" && profile.id && profile.name)
        .map(([id, profile]) => [
          id,
          {
            ...profile,
            mcqProgress: normalizeMcqProgress(profile.mcqProgress),
          },
        ])
    );
    const activeProfileId = profiles[parsed.activeProfileId] ? parsed.activeProfileId : null;

    return { version: 1, activeProfileId, profiles };
  } catch {
    return createEmptyProfileStore();
  }
}

function saveProfileStore(profileStore) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileStore));
  } catch {
    // Ignore storage errors so the app remains usable in private browsing.
  }
}

function profileFromRemoteRow(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at || new Date().toISOString(),
    mcqProgress: normalizeMcqProgress(row.mcq_progress),
  };
}

function profileToRemoteRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    mcq_progress: normalizeMcqProgress(profile.mcqProgress),
  };
}

function getRecordTimestamp(record = {}) {
  return record.updatedAt || record.lastAnsweredAt || record.seenAt || null;
}

function shouldUseRemoteQuestionState(progress, localRecord, remoteUpdatedAt) {
  if (!remoteUpdatedAt) return !localRecord || Object.keys(localRecord).length === 0;
  if (progress.resetAt && new Date(remoteUpdatedAt) <= new Date(progress.resetAt)) return false;
  if (!localRecord || Object.keys(localRecord).length === 0) return true;

  const localTimestamp = getRecordTimestamp(localRecord);
  return !localTimestamp || new Date(remoteUpdatedAt) >= new Date(localTimestamp);
}

function questionStateRowToRecord(row) {
  const correctCount = row.correct_count || 0;
  const wrongCount = row.wrong_count || 0;
  const seenCount = row.seen_count || correctCount + wrongCount;
  const masteryLevel = row.mastery_level || 0;

  return {
    seenAt: row.last_seen_at || row.updated_at || null,
    lastAnsweredAt: row.updated_at || row.last_seen_at || null,
    lastCorrect: row.last_answer_correct,
    lastConfidence: row.last_confidence || null,
    lastTimeTakenMs: row.average_time_ms || null,
    attempts: correctCount + wrongCount,
    seenCount,
    correctCount,
    incorrectCount: wrongCount,
    wrongCount,
    streak: row.consecutive_correct || 0,
    consecutiveCorrect: row.consecutive_correct || 0,
    consecutiveWrong: row.consecutive_wrong || 0,
    confidentWrongCount: row.confident_wrong_count || 0,
    masteryLevel,
    mastery_level: masteryLevel,
    mastered: masteryLevel === 5,
    nextReviewAt: row.next_review_at || null,
    averageTimeMs: row.average_time_ms || null,
    totalPoints: row.total_points || 0,
    updatedAt: row.updated_at || null,
  };
}

function mergeQuestionStateRowsIntoProfile(profile, rows) {
  if (!rows.length) return profile;

  const progress = normalizeMcqProgress(profile.mcqProgress);
  const questions = { ...(progress.questions || {}) };

  rows.forEach(row => {
    const questionId = String(row.question_id);
    const localRecord = questions[questionId];
    if (!shouldUseRemoteQuestionState(progress, localRecord, row.updated_at)) return;

    questions[questionId] = {
      ...(localRecord || {}),
      ...questionStateRowToRecord(row),
    };
  });

  return {
    ...profile,
    mcqProgress: {
      ...progress,
      questions,
    },
  };
}

async function supabaseProfilesRequest(searchParams = {}, options = {}) {
  if (!ONLINE_PROFILES_ENABLED) {
    throw new Error("Online profiles are not configured.");
  }

  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${SUPABASE_PROFILE_TABLE}`);
  Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function supabaseTableRequest(tableName, searchParams = {}, options = {}) {
  if (!ONLINE_PROFILES_ENABLED) {
    throw new Error("Online profiles are not configured.");
  }

  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${tableName}`);
  Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function quoteSupabaseInValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function loadRemoteQuestionStates(profileIds) {
  if (!profileIds.length) return [];

  return supabaseTableRequest("user_question_state", {
    select: [
      "profile_id",
      "question_id",
      "seen_count",
      "correct_count",
      "wrong_count",
      "consecutive_correct",
      "consecutive_wrong",
      "mastery_level",
      "last_seen_at",
      "next_review_at",
      "last_answer_correct",
      "last_confidence",
      "confident_wrong_count",
      "average_time_ms",
      "total_points",
      "updated_at",
    ].join(","),
    profile_id: `in.(${profileIds.map(quoteSupabaseInValue).join(",")})`,
    limit: "10000",
  });
}

async function loadRemoteProfileStore(activeProfileId = null) {
  const rows = await supabaseProfilesRequest({
    select: "id,name,mcq_progress,created_at",
    order: "name.asc",
  });
  const profiles = Object.fromEntries(
    rows.map(row => {
      const profile = profileFromRemoteRow(row);
      return [profile.id, profile];
    })
  );
  try {
    const questionStateRows = await loadRemoteQuestionStates(Object.keys(profiles));
    questionStateRows.forEach(row => {
      const profile = profiles[row.profile_id];
      if (!profile) return;
      profiles[row.profile_id] = mergeQuestionStateRowsIntoProfile(profile, [row]);
    });
  } catch {
    // Keep profile JSON loading reliable if the optional normalized table is not present yet.
  }
  const activeId = profiles[activeProfileId] ? activeProfileId : null;

  return { version: 1, activeProfileId: activeId, profiles };
}

async function upsertRemoteProfile(profile) {
  const rows = await supabaseProfilesRequest(
    { on_conflict: "id" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profileToRemoteRow(profile)),
    }
  );

  return profileFromRemoteRow(rows[0]);
}

async function saveRemoteMcqProgress(profileId, progress) {
  await supabaseProfilesRequest(
    { id: `eq.${profileId}` },
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        mcq_progress: progress,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function saveRemoteAnswerBehavior(profileId, progress) {
  const attempt = progress.attempts?.[0];
  if (!attempt) return;

  const questionState = progress.questions?.[attempt.questionId];
  if (!questionState) return;

  await supabaseTableRequest(
    "user_question_state",
    { on_conflict: "profile_id,question_id" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        profile_id: profileId,
        question_id: attempt.questionId,
        seen_count: questionState.seenCount || questionState.attempts || 0,
        correct_count: questionState.correctCount || 0,
        wrong_count: questionState.wrongCount || questionState.incorrectCount || 0,
        consecutive_correct: questionState.consecutiveCorrect || 0,
        consecutive_wrong: questionState.consecutiveWrong || 0,
        mastery_level: questionState.masteryLevel || questionState.mastery_level || 0,
        last_seen_at: questionState.seenAt || null,
        next_review_at: questionState.nextReviewAt || null,
        last_answer_correct: questionState.lastCorrect ?? null,
        last_confidence: questionState.lastConfidence || null,
        confident_wrong_count: questionState.confidentWrongCount || 0,
        average_time_ms: questionState.averageTimeMs || (questionState.lastTimeTakenMs ? Math.round(questionState.lastTimeTakenMs) : null),
        total_points: questionState.totalPoints || 0,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  await supabaseTableRequest(
    "question_attempts",
    {},
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        client_attempt_id: attempt.id,
        profile_id: profileId,
        question_id: attempt.questionId,
        mode: attempt.mode,
        selected_option: attempt.selectedOption,
        is_correct: attempt.isCorrect,
        confidence: attempt.confidence,
        time_taken_ms: attempt.timeTakenMs ? Math.round(attempt.timeTakenMs) : null,
        points_awarded: attempt.pointsAwarded || 0,
        streak_position: attempt.streakPosition || 0,
        attempted_at: attempt.attemptedAt,
      }),
    }
  );
}

async function deleteRemoteQuestionBehavior(profileId) {
  await supabaseTableRequest(
    "question_attempts",
    { profile_id: `eq.${profileId}` },
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }
  );

  await supabaseTableRequest(
    "user_question_state",
    { profile_id: `eq.${profileId}` },
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }
  );
}

function summarizeMcqProgress(progress) {
  const records = progress.questions || {};
  const total = QUESTIONS.length;
  const seen = QUESTIONS.filter(q => hasSeenQuestion(records[q.id])).length;
  const attempted = QUESTIONS.filter(q => getAttemptsCount(records[q.id]) > 0).length;
  const mastered = QUESTIONS.filter(q => isQuestionMastered(records[q.id])).length;
  const correct = QUESTIONS.reduce((sum, q) => sum + (records[q.id]?.correctCount || 0), 0);
  const attempts = QUESTIONS.reduce((sum, q) => sum + getAttemptsCount(records[q.id]), 0);

  return {
    total,
    seen,
    unseen: Math.max(0, total - seen),
    attempted,
    mastered,
    review: Math.max(0, attempted - mastered),
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
  };
}

function getQuestionProgress(progress, questionId) {
  return progress.questions?.[questionId] || {};
}

function getAttemptsCount(record = {}) {
  return Math.max(record.attempts || 0, (record.correctCount || 0) + (record.wrongCount || record.incorrectCount || 0));
}

function getSeenCount(record = {}) {
  return Math.max(record.seenCount || 0, getAttemptsCount(record), record.seenAt ? 1 : 0);
}

function getWrongCount(record = {}) {
  return record.wrongCount ?? record.incorrectCount ?? 0;
}

function getAccuracy(record = {}) {
  const attempts = getAttemptsCount(record);
  if (!attempts) return null;
  return (record.correctCount || 0) / attempts;
}

function hasSeenQuestion(record = {}) {
  return !!record.seenAt || getSeenCount(record) > 0;
}

function isQuestionMastered(record = {}) {
  return record.masteryLevel === 5 || record.mastery_level === 5 || record.mastered === true;
}

function getQuestionStatus(record) {
  if (isQuestionMastered(record)) return "Mastered";
  if (getAttemptsCount(record) > 0) return "Review";
  if (hasSeenQuestion(record)) return "Seen";
  return "New";
}

function getMasteryLevel(record = {}) {
  if (Number.isInteger(record.masteryLevel)) return record.masteryLevel;
  if (Number.isInteger(record.mastery_level)) return record.mastery_level;
  if (record.mastered) return 5;
  if ((record.streak || 0) >= 2) return 4;
  if (getAttemptsCount(record) > 0) return record.lastCorrect ? 3 : 1;
  return 0;
}

function getConsecutiveCorrect(record = {}) {
  return record.consecutiveCorrect ?? record.consecutive_correct ?? record.streak ?? 0;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysSince(timestamp, now = new Date()) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function isDue(record = {}, now = new Date()) {
  if (!record.nextReviewAt) return getAttemptsCount(record) > 0;
  const dueAt = new Date(record.nextReviewAt);
  if (Number.isNaN(dueAt.getTime())) return getAttemptsCount(record) > 0;
  return dueAt <= now;
}

function calculateSprintPoints({ isCorrect, timeTakenMs, timeLimitMs, currentStreak }) {
  if (!isCorrect) return { base: 0, speed: 0, streak: 0, total: 0 };

  let speed = 10;
  const ratio = timeTakenMs / timeLimitMs;

  if (ratio <= 0.33) speed = 50;
  else if (ratio <= 0.66) speed = 30;

  const streak = Math.min(currentStreak * 35, 250);

  return { base: 100, speed, streak, total: 100 + speed + streak };
}

function calculateStandardPoints({ isCorrect, mode, currentStreak }) {
  if (!isCorrect) return { base: 0, speed: 0, streak: 0, total: 0 };
  const base = mode === "weakness" ? 120 : 100;
  const streak = Math.min(currentStreak * 20, 120);
  return { base, speed: 0, streak, total: base + streak };
}

function inferAnswerConfidence({ mode, timeTakenMs, timeLimitMs, isCorrect }) {
  if (mode !== "sprint") return 3;

  const ratio = timeTakenMs / timeLimitMs;
  if (ratio <= 0.33) return isCorrect ? 4 : 3;
  if (ratio <= 0.66) return 3;
  return 2;
}

function getNextReviewIntervalDays({ masteryLevel, isCorrect, confidence, consecutiveCorrect }) {
  if (!isCorrect && confidence >= 3) return 0.25;
  if (!isCorrect) return 1;
  if (consecutiveCorrect >= MASTERY_STREAK_TARGET) return 21;
  if (masteryLevel <= 1) return 1;
  if (masteryLevel === 2) return 3;
  if (masteryLevel === 3) return 7;
  if (masteryLevel === 4) return 14;
  return 21;
}

function updateMasteryLevel({ previousMastery, isCorrect, confidence, consecutiveCorrect }) {
  if (isCorrect && consecutiveCorrect >= MASTERY_STREAK_TARGET) return 5;

  let mastery = previousMastery ?? 0;

  if (isCorrect) {
    mastery += confidence === 4 ? 2 : 1;
  } else if (previousMastery >= 5) {
    mastery = 3;
  } else {
    mastery -= confidence >= 3 ? 2 : 1;
  }

  return Math.max(0, Math.min(5, mastery));
}

function scoreQuestionForWeakness(question, progress, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const attempts = getAttemptsCount(record);
  const wrongCount = getWrongCount(record);
  const accuracy = getAccuracy(record);
  const mastery = getMasteryLevel(record);
  const daysSinceAnswer = getDaysSince(record.lastAnsweredAt || record.seenAt, now);
  let score = 0;

  if (!hasSeenQuestion(record)) return 8 + Math.random() * 3;
  if ((record.confidentWrongCount || 0) > 0) score += 45 + Math.min(record.confidentWrongCount || 0, 4) * 10;
  if ((record.consecutiveWrong || 0) >= 2) score += 70;
  else if ((record.consecutiveWrong || 0) === 1) score += 35;
  if (wrongCount >= 3) score += 45;
  if (attempts >= 3 && accuracy !== null && accuracy < 0.5) score += 55;
  else if (attempts >= 2 && accuracy !== null && accuracy < 0.7) score += 30;
  if (mastery <= 1 && attempts > 0) score += 45;
  if (mastery === 2) score += 30;
  if (isDue(record, now)) score += isQuestionMastered(record) ? 18 : 35;
  if (daysSinceAnswer !== null && daysSinceAnswer >= 14 && !isQuestionMastered(record)) score += 12;

  return score + Math.random() * 5;
}

function scoreQuestionForStudyPriority(question, progress, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const weaknessScore = scoreQuestionForWeakness(question, progress, now);
  const mastery = getMasteryLevel(record);
  const daysSinceAnswer = getDaysSince(record.lastAnsweredAt || record.seenAt, now);
  let score = weaknessScore;

  if (!hasSeenQuestion(record)) score += 55;
  if (isDue(record, now)) score += 35;
  if (mastery > 0 && mastery < 5) score += 25;
  if (isQuestionMastered(record) && isDue(record, now)) score += 20;
  if (daysSinceAnswer === null) score += 20;
  else if (daysSinceAnswer >= 30) score += 18;
  else if (daysSinceAnswer >= 14) score += 10;

  return score + Math.random() * 10;
}

function isWeaknessCandidate(question, progress) {
  const record = getQuestionProgress(progress, question.id);
  const attempts = getAttemptsCount(record);
  const accuracy = getAccuracy(record);

  return attempts > 0 && (
    getWrongCount(record) > 0 ||
    (record.consecutiveWrong || 0) > 0 ||
    (record.confidentWrongCount || 0) > 0 ||
    (attempts >= 3 && accuracy !== null && accuracy < 0.7)
  );
}

function scoreQuestionForRandomReview(question, progress, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const attempts = getAttemptsCount(record);
  if (!attempts) return -Infinity;

  const daysSinceAnswer = getDaysSince(record.lastAnsweredAt || record.seenAt, now);
  if (record.lastCorrect && daysSinceAnswer !== null && daysSinceAnswer < 7 && !isDue(record, now)) {
    return -Infinity;
  }

  let score = 0;
  if (getWrongCount(record) > 0) score += 30;
  if ((record.consecutiveWrong || 0) > 0) score += 35;
  if ((record.confidentWrongCount || 0) > 0) score += 30;
  if (isDue(record, now)) score += 25;
  if (daysSinceAnswer === null) score += 5;
  else score += Math.min(daysSinceAnswer, 60);
  if (record.lastCorrect) score -= 12;

  return score + Math.random() * 4;
}

function selectUniqueQuestions(candidates, count, usedIds = new Set()) {
  const selected = [];

  for (const item of candidates) {
    const question = item.question || item;
    if (!question || usedIds.has(question.id)) continue;
    usedIds.add(question.id);
    selected.push(item);
    if (selected.length >= count) break;
  }

  return selected;
}

function selectWeaknessQuestions(progress, count = WEAKNESS_SESSION_SIZE) {
  const scored = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForWeakness(question, progress) }))
    .filter(item => isWeaknessCandidate(item.question, progress) && item.score >= 25)
    .sort((a, b) => b.score - a.score);

  return selectUniqueQuestions(scored, count).map(item => item.question);
}

function selectSprintQuestions(progress, count = SPRINT_SESSION_SIZE) {
  const records = progress.questions || {};
  const shuffled = selectRandomQuestions(QUESTIONS.length);
  const unseen = shuffled.filter(question => !hasSeenQuestion(records[question.id]));
  const lightlySeen = shuffled.filter(question => {
    const record = records[question.id];
    return hasSeenQuestion(record) && getSeenCount(record) <= 1;
  });
  const weakOrDue = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);
  const fallback = shuffled.filter(question => !isQuestionMastered(records[question.id]) || isDue(records[question.id]));

  return selectUniqueQuestions([...unseen, ...lightlySeen, ...weakOrDue, ...fallback, ...shuffled], count);
}

function selectRandomPracticeQuestions(progress) {
  const now = new Date();
  const shuffled = selectRandomQuestions(QUESTIONS.length);
  const usedIds = new Set();
  const reviewCandidates = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForRandomReview(question, progress, now) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);
  const randomQueue = [...shuffled];
  const reviewQueue = [...reviewCandidates];
  const selected = [];

  for (let index = 0; index < QUESTIONS.length; index += 1) {
    const shouldUseReviewSlot = (index + 1) % 7 === 0;
    const queue = shouldUseReviewSlot ? reviewQueue : randomQueue;
    let next = null;

    while (queue.length && !next) {
      const candidate = queue.shift();
      if (!usedIds.has(candidate.id)) next = candidate;
    }

    if (!next) {
      while (randomQueue.length && !next) {
        const candidate = randomQueue.shift();
        if (!usedIds.has(candidate.id)) next = candidate;
      }
    }

    if (!next) break;
    usedIds.add(next.id);
    selected.push(next);
  }

  return selected;
}

function getDailyChallenge(progress, dateKey = getLocalDateKey()) {
  return progress.dailyChallenges?.[dateKey] || null;
}

function createDailyChallenge(progress, dateKey = getLocalDateKey()) {
  const existing = getDailyChallenge(progress, dateKey);
  if (existing?.questionIds?.length) return existing;

  const now = new Date();
  const records = progress.questions || {};
  const usedIds = new Set();
  const byPriority = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress, now), reason: "repeated_wrong" }))
    .sort((a, b) => b.score - a.score);
  const repeatedWrong = selectUniqueQuestions(byPriority.filter(item => {
    const record = records[item.question.id];
    return getWrongCount(record) > 0 || (record?.consecutiveWrong || 0) > 0 || (record?.confidentWrongCount || 0) > 0;
  }), 4, usedIds);
  const masteredDue = selectUniqueQuestions(
    QUESTIONS
      .filter(question => isQuestionMastered(records[question.id]) && isDue(records[question.id], now))
      .map(question => ({ question, reason: "mastered_due" })),
    2,
    usedIds
  );
  const normalDue = selectUniqueQuestions(
    byPriority
      .filter(item => {
        const record = records[item.question.id];
        const mastery = getMasteryLevel(record);
        return mastery > 0 && mastery < 5 && isDue(record, now);
      })
      .map(item => ({ question: item.question, reason: "normal_due" })),
    3,
    usedIds
  );
  const novelty = selectUniqueQuestions(
    selectRandomQuestions(QUESTIONS.length)
      .filter(question => !hasSeenQuestion(records[question.id]))
      .map(question => ({ question, reason: "unseen_or_random" })),
    1,
    usedIds
  );
  const selected = [...repeatedWrong, ...masteredDue, ...normalDue, ...novelty];
  const fallback = selectUniqueQuestions(
    selectRandomQuestions(QUESTIONS.length).map(question => ({ question, reason: "fallback_random" })),
    DAILY_CHALLENGE_SIZE - selected.length,
    usedIds
  );
  const items = [...selected, ...fallback].slice(0, DAILY_CHALLENGE_SIZE).map((item, index) => ({
    questionId: item.question.id,
    reason: item.reason,
    position: index + 1,
    answered: false,
  }));

  return {
    date: dateKey,
    questionIds: items.map(item => item.questionId),
    items,
    createdAt: new Date().toISOString(),
  };
}

function ensureDailyChallenge(progress, dateKey = getLocalDateKey()) {
  const challenge = createDailyChallenge(progress, dateKey);

  return {
    progress: {
      ...progress,
      dailyChallenges: {
        ...(progress.dailyChallenges || {}),
        [dateKey]: challenge,
      },
      updatedAt: new Date().toISOString(),
    },
    challenge,
  };
}

function getSessionQuestions(mode, progress) {
  if (mode === "daily") {
    return createDailyChallenge(progress).questionIds
      .map(id => QUESTIONS.find(question => question.id === id))
      .filter(Boolean);
  }
  if (mode === "sprint") return selectSprintQuestions(progress, SPRINT_SESSION_SIZE);
  if (mode === "weakness") return selectWeaknessQuestions(progress, WEAKNESS_SESSION_SIZE);
  return selectRandomPracticeQuestions(progress);
}

function getDailyReason(progress, questionId, dateKey = getLocalDateKey()) {
  const item = progress.dailyChallenges?.[dateKey]?.items?.find(entry => entry.questionId === questionId);
  return item?.reason || null;
}

function getDailyReasonLabel(reason) {
  const labels = {
    repeated_wrong: "Repeatedly wrong",
    mastered_due: "Mastered review",
    normal_due: "Due review",
    unseen_or_random: "New item",
    fallback_random: "Mixed review",
  };
  return labels[reason] || null;
}

function markQuestionSeen(progress, questionId) {
  const current = getQuestionProgress(progress, questionId);
  if (current.seenAt) return progress;

  return {
    ...progress,
    updatedAt: new Date().toISOString(),
    questions: {
      ...(progress.questions || {}),
      [questionId]: {
        ...current,
        seenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

function recordQuestionAnswer(progress, question, selected, {
  mode = "random",
  confidence = 3,
  timeTakenMs = null,
  pointsAwarded = 0,
  pointBreakdown = null,
  sessionId = null,
  streakPosition = 0,
} = {}) {
  const current = getQuestionProgress(progress, question.id);
  const isCorrect = selected === question.correct;
  const previousMastery = getMasteryLevel(current);
  const consecutiveCorrect = isCorrect ? getConsecutiveCorrect(current) + 1 : 0;
  const consecutiveWrong = isCorrect ? 0 : (current.consecutiveWrong || current.consecutive_wrong || 0) + 1;
  const masteryLevel = updateMasteryLevel({ previousMastery, isCorrect, confidence, consecutiveCorrect });
  const intervalDays = getNextReviewIntervalDays({ masteryLevel, isCorrect, confidence, consecutiveCorrect });
  const now = new Date();
  const previousAttempts = getAttemptsCount(current);
  const previousAverageTime = current.averageTimeMs || current.average_time_ms || current.lastTimeTakenMs || 0;
  const averageTimeMs = timeTakenMs !== null
    ? Math.round(((previousAverageTime * previousAttempts) + timeTakenMs) / (previousAttempts + 1))
    : previousAverageTime || null;
  const attempt = {
    id: `${now.getTime()}-${question.id}`,
    sessionId,
    mode,
    questionId: question.id,
    selected,
    selectedOption: Number.isInteger(selected) ? OPTION_LETTERS[selected] : null,
    isCorrect,
    confidence,
    timeTakenMs,
    pointsAwarded,
    pointBreakdown,
    streakPosition,
    attemptedAt: now.toISOString(),
  };
  const attempts = [attempt, ...(progress.attempts || [])].slice(0, 500);
  const dailyChallenges = { ...(progress.dailyChallenges || {}) };

  if (mode === "daily") {
    const dateKey = getLocalDateKey(now);
    const challenge = dailyChallenges[dateKey];
    if (challenge) {
      dailyChallenges[dateKey] = {
        ...challenge,
        items: (challenge.items || []).map(item =>
          item.questionId === question.id ? { ...item, answered: true } : item
        ),
      };
    }
  }

  return {
    ...progress,
    attempts,
    dailyChallenges,
    updatedAt: new Date().toISOString(),
    questions: {
      ...(progress.questions || {}),
      [question.id]: {
        ...current,
        seenAt: current.seenAt || new Date().toISOString(),
        lastAnsweredAt: new Date().toISOString(),
        lastSelected: selected,
        lastCorrect: isCorrect,
        lastConfidence: confidence,
        lastTimeTakenMs: timeTakenMs,
        lastPointsAwarded: pointsAwarded,
        attempts: previousAttempts + 1,
        seenCount: getSeenCount(current) + 1,
        correctCount: (current.correctCount || 0) + (isCorrect ? 1 : 0),
        incorrectCount: getWrongCount(current) + (isCorrect ? 0 : 1),
        wrongCount: getWrongCount(current) + (isCorrect ? 0 : 1),
        streak: consecutiveCorrect,
        consecutiveCorrect,
        consecutiveWrong,
        confidentWrongCount: (current.confidentWrongCount || 0) + (!isCorrect && confidence >= 3 ? 1 : 0),
        masteryLevel,
        mastery_level: masteryLevel,
        mastered: masteryLevel === 5,
        nextReviewAt: addDays(now, intervalDays).toISOString(),
        averageTimeMs,
        totalPoints: (current.totalPoints || 0) + pointsAwarded,
        updatedAt: now.toISOString(),
      },
    },
  };
}

function recordSprintSession(progress, session) {
  const currentSessions = Array.isArray(progress.sprintSessions) ? progress.sprintSessions : [];
  const sessions = [session, ...currentSessions.filter(item => item.id !== session.id)].slice(0, 30);

  return {
    ...progress,
    sprintSessions: sessions,
    updatedAt: new Date().toISOString(),
  };
}

function getSprintSessions(progress) {
  return [...(progress.sprintSessions || [])].sort((a, b) => {
    return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
  });
}

function getSprintHighScore(progress) {
  return getSprintSessions(progress).reduce((best, session) => {
    return Math.max(best, session.points || 0);
  }, 0);
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ICONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const Icons = {
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <path d="M9.5 2a3.5 3.5 0 0 0-3.2 4.8A3.5 3.5 0 0 0 4 10.5a3.5 3.5 0 0 0 1.3 2.7A3.5 3.5 0 0 0 4 16a3.5 3.5 0 0 0 3.5 3.5h.5a2 2 0 0 0 4 0V5a3.5 3.5 0 0 0-2.5-3z"/>
      <path d="M14.5 2a3.5 3.5 0 0 1 3.2 4.8A3.5 3.5 0 0 1 20 10.5a3.5 3.5 0 0 1-1.3 2.7A3.5 3.5 0 0 1 20 16a3.5 3.5 0 0 1-3.5 3.5h-.5a2 2 0 0 1-4 0V5a3.5 3.5 0 0 1 2.5-3z"/>
    </svg>
  ),
  ClipboardCheck: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>
    </svg>
  ),
  Mic: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  ),
  Pill: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>
    </svg>
  ),
  BookOpen: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
    </svg>
  ),
  Globe: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20}}>
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20}}>
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Skip: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
      <polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
      <polyline points="9,21 9,13 15,13 15,21"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20}}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STYLES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap');

  :root {
    --bg: #0a0e17;
    --bg-card: #111827;
    --bg-card-hover: #1a2332;
    --bg-surface: #151d2e;
    --text: #e8ecf4;
    --text-dim: #7a8ba8;
    --text-muted: #4a5a75;
    --accent: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.15);
    --accent-soft: #1e3a5f;
    --green: #22c55e;
    --green-bg: rgba(34, 197, 94, 0.12);
    --red: #ef4444;
    --red-bg: rgba(239, 68, 68, 0.12);
    --gold: #f59e0b;
    --gold-bg: rgba(245, 158, 11, 0.12);
    --border: rgba(255,255,255,0.06);
    --border-active: rgba(59, 130, 246, 0.4);
    --radius: 12px;
    --radius-sm: 8px;
    --shadow: 0 4px 24px rgba(0,0,0,0.3);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .icon { width: 28px; height: 28px; }

  .app {
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  /* â”€â”€â”€ HOME SCREEN â”€â”€â”€ */
  .home {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  .home-header {
    text-align: center;
    margin-bottom: 56px;
  }

  .home-logo {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    box-shadow: 0 8px 32px rgba(59,130,246,0.25);
  }

  .home-logo .icon { color: white; width: 32px; height: 32px; }

  .home-title {
    font-family: 'Instrument Serif', serif;
    font-size: 42px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-bottom: 12px;
  }

  .home-subtitle {
    color: var(--text-dim);
    font-size: 16px;
    font-weight: 400;
  }

  .profile-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    color: var(--text-dim);
    font-size: 13px;
  }

  .profile-switch {
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    transition: all 0.2s;
  }

  .profile-switch:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
  }

  .profile-screen {
    max-width: 520px;
    margin: 0 auto;
    padding: 56px 24px 80px;
  }

  .profile-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
  }

  .profile-panel h1 {
    font-family: 'Instrument Serif', serif;
    font-size: 34px;
    font-weight: 400;
    margin-bottom: 8px;
  }

  .profile-panel p {
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 22px;
  }

  .sync-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 12px;
    padding: 5px 10px;
    margin-bottom: 18px;
  }

  .sync-status.online {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
  }

  .sync-status.saving,
  .sync-status.loading {
    background: rgba(59,130,246,0.12);
    border-color: rgba(59,130,246,0.3);
    color: #93c5fd;
  }

  .sync-status.offline,
  .sync-status.local {
    background: var(--gold-bg);
    border-color: rgba(245,158,11,0.35);
    color: var(--gold);
  }

  .profile-form {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .profile-input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-family: inherit;
    font-size: 15px;
    outline: none;
  }

  .profile-input:focus {
    border-color: var(--border-active);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .profile-error {
    color: #fca5a5;
    font-size: 12px;
    margin: -12px 0 18px;
  }

  .profile-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .profile-list-title {
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 2px;
  }

  .profile-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: all 0.2s;
  }

  .profile-btn:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
  }

  .profile-btn small {
    color: var(--text-dim);
    font-size: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px 24px;
    cursor: pointer;
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;
  }

  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0;
    transition: opacity 0.25s;
  }

  .card:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .card:hover::before { opacity: 1; }

  .card.full-width {
    grid-column: 1 / -1;
  }

  .card.disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .card-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: white;
  }

  .card-icon-lg { width: 72px; height: 72px; border-radius: 18px; margin-bottom: 20px; }
  .card-icon-lg .icon { width: 36px; height: 36px; }

  .card-icon.blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .card-icon.purple { background: rgba(139,92,246,0.15); color: #a78bfa; }
  .card-icon.emerald { background: rgba(16,185,129,0.15); color: #34d399; }
  .card-icon.amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
  .card-icon.rose { background: rgba(244,63,94,0.15); color: #fb7185; }
  .card-icon.cyan { background: rgba(6,182,212,0.15); color: #22d3ee; }

  .card-title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 6px;
  }

  .card-desc {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.5;
  }

  .card-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 4px;
    margin-top: 12px;
    background: rgba(245,158,11,0.12);
    color: #fbbf24;
  }

  /* â”€â”€â”€ MCQ SELECTION â”€â”€â”€ */
  .mcq-select {
    max-width: 560px;
    margin: 0 auto;
    padding: 48px 24px;
    text-align: center;
  }

  .mcq-select h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 32px;
    font-weight: 400;
    margin-bottom: 8px;
  }

  .mcq-select p {
    color: var(--text-dim);
    margin-bottom: 40px;
  }

  .mode-btn {
    display: block;
    width: 100%;
    padding: 20px 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    margin-bottom: 12px;
    font-family: inherit;
  }

  .mode-btn:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
  }

  .mode-btn.featured {
    border-color: rgba(34,197,94,0.35);
    background: rgba(34,197,94,0.08);
  }

  .mode-btn small {
    display: block;
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 400;
    margin-top: 4px;
  }

  .mcq-memory {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 18px;
  }

  .mcq-memory-stat {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 10px;
    text-align: center;
  }

  .mcq-memory-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .mcq-memory-label {
    display: block;
    color: var(--text-dim);
    font-size: 11px;
    margin-top: 2px;
  }

  .game-hud {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 0 0 18px;
  }

  .hud-stat {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px;
    text-align: center;
  }

  .hud-value {
    display: block;
    color: var(--text);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .hud-label {
    display: block;
    color: var(--text-dim);
    font-size: 10px;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sprint-timer-track {
    height: 7px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
    margin: -8px 0 18px;
  }

  .sprint-timer-fill {
    height: 100%;
    background: var(--green);
    border-radius: inherit;
    transition: width 0.25s linear, background 0.2s ease;
  }

  .sprint-timer-fill.warning {
    background: var(--gold);
  }

  .sprint-timer-fill.danger {
    background: var(--red);
  }

  .confidence-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: -10px 0 22px;
  }

  .confidence-label {
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
  }

  .confidence-btn {
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-dim);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    transition: all 0.2s;
  }

  .confidence-btn.active {
    background: var(--accent-soft);
    border-color: var(--border-active);
    color: var(--text);
  }

  .point-breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    animation: point-pop 0.35s ease-out;
  }

  @keyframes point-pop {
    0% {
      opacity: 0;
      transform: translateY(6px) scale(0.97);
    }
    70% {
      transform: translateY(-2px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .point-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 12px;
    padding: 5px 9px;
  }

  .point-pill.total {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
    font-weight: 700;
  }

  .point-breakdown.low .point-pill.total {
    background: var(--red-bg);
    border-color: rgba(239,68,68,0.35);
    color: var(--red);
  }

  .point-breakdown.medium .point-pill.total {
    background: var(--gold-bg);
    border-color: rgba(245,158,11,0.35);
    color: var(--gold);
  }

  .point-breakdown.high .point-pill.total {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
  }

  .sprint-auto-toggle {
    position: fixed;
    right: 18px;
    bottom: 78px;
    z-index: 120;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-dim);
    border-radius: var(--radius-sm);
    padding: 9px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition: all 0.2s;
  }

  .sprint-auto-toggle.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .sprint-auto-toggle:hover {
    transform: translateY(-1px);
  }

  .reset-progress-btn {
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    margin-top: 10px;
  }

  .reset-progress-btn:hover { color: var(--red); }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim);
    font-size: 14px;
    cursor: pointer;
    margin-bottom: 32px;
    background: none;
    border: none;
    font-family: inherit;
    transition: color 0.2s;
  }

  .back-link:hover { color: var(--text); }

  .home-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--text-dim);
    font-size: 13px;
    cursor: pointer;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 7px 12px;
    font-family: inherit;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .home-btn:hover { color: var(--text); background: var(--bg-card-hover); }

  /* â”€â”€â”€ MCQ TEST â”€â”€â”€ */
  .test-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 24px 120px;
  }

  .test-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    gap: 16px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--bg-surface);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.4s ease;
    border-radius: 2px;
  }

  .progress-text {
    font-size: 13px;
    color: var(--text-dim);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .question-num {
    font-family: 'Instrument Serif', serif;
    font-size: 14px;
    color: var(--accent);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .question-status {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
  }

  .question-status.mastered {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
  }

  .question-status.review {
    background: var(--gold-bg);
    border-color: rgba(245,158,11,0.35);
    color: var(--gold);
  }

  .question-status.seen {
    background: rgba(59,130,246,0.12);
    border-color: rgba(59,130,246,0.3);
    color: #93c5fd;
  }

  .question-stem {
    font-size: 17px;
    line-height: 1.65;
    margin-bottom: 28px;
    font-weight: 400;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option-btn {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-family: inherit;
    width: 100%;
  }

  .option-btn:hover:not(.locked):not(.selected) {
    background: var(--bg-card-hover);
    border-color: rgba(255,255,255,0.1);
  }

  .option-btn.selected {
    background: var(--accent-soft);
    border-color: var(--border-active);
  }

  .option-btn.locked.correct {
    background: var(--green-bg);
    border-color: var(--green);
  }

  .option-btn.locked.incorrect {
    background: var(--red-bg);
    border-color: var(--red);
  }

  .option-btn.locked.was-correct {
    background: var(--green-bg);
    border-color: var(--green);
    opacity: 0.7;
  }

  .option-letter {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .option-btn.selected .option-letter {
    background: var(--accent);
    color: white;
  }

  .option-btn.locked.correct .option-letter {
    background: var(--green);
    color: white;
  }

  .option-btn.locked.incorrect .option-letter {
    background: var(--red);
    color: white;
  }

  .explanation-box {
    margin-top: 20px;
    padding: 18px 20px;
    background: var(--bg-surface);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--accent);
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-dim);
    animation: fadeIn 0.3s ease;
  }

  .explanation-box strong {
    color: var(--text);
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* â”€â”€â”€ NAVIGATION BAR â”€â”€â”€ */
  .nav-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    justify-content: center;
    gap: 10px;
    z-index: 100;
  }

  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text);
  }

  .nav-btn:hover { background: var(--bg-card-hover); }
  .nav-btn:disabled { opacity: 0.3; pointer-events: none; }

  .nav-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .nav-btn.primary:hover { background: #2563eb; }

  .nav-btn.danger {
    background: rgba(239,68,68,0.15);
    border-color: rgba(239,68,68,0.3);
    color: #fca5a5;
  }

  /* â”€â”€â”€ RESULTS â”€â”€â”€ */
  .results {
    max-width: 600px;
    margin: 0 auto;
    padding: 48px 24px;
    text-align: center;
  }

  .results-score {
    font-family: 'Instrument Serif', serif;
    font-size: 72px;
    font-weight: 400;
    line-height: 1;
    margin-bottom: 8px;
  }

  .results-score.excellent { color: var(--green); }
  .results-score.good { color: var(--accent); }
  .results-score.pass { color: var(--gold); }
  .results-score.fail { color: var(--red); }

  .results-label {
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .results-detail {
    color: var(--text-dim);
    font-size: 15px;
    margin-bottom: 40px;
  }

  .results-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .results-btn {
    padding: 12px 24px;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text);
  }

  .results-btn:hover { background: var(--bg-card-hover); }
  .results-btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
  .results-btn.primary:hover { background: #2563eb; }

  /* â”€â”€â”€ MODAL â”€â”€â”€ */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 0.2s ease;
  }

  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px;
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }

  .modal h3 {
    font-family: 'Instrument Serif', serif;
    font-size: 24px;
    font-weight: 400;
    margin-bottom: 12px;
  }

  .modal p {
    color: var(--text-dim);
    font-size: 14px;
    margin-bottom: 24px;
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .sprint-results-modal {
    max-width: 520px;
  }

  .sprint-score {
    font-size: 56px;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
    margin: 6px 0 18px;
    font-variant-numeric: tabular-nums;
  }

  .sprint-result-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 16px 0;
  }

  .sprint-result-stat {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px;
  }

  .sprint-result-stat strong {
    display: block;
    color: var(--text);
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }

  .sprint-result-stat span {
    display: block;
    color: var(--text-dim);
    font-size: 11px;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sprint-history {
    margin: 18px 0 22px;
    text-align: left;
  }

  .sprint-history-title {
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sprint-history-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--border);
    padding: 8px 0;
    color: var(--text-dim);
    font-size: 13px;
  }

  .sprint-history-row strong {
    color: var(--text);
  }

  /* â”€â”€â”€ PLACEHOLDER â”€â”€â”€ */
  .placeholder-page {
    max-width: 560px;
    margin: 0 auto;
    padding: 48px 24px;
    text-align: center;
  }

  .placeholder-icon {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    background: var(--bg-surface);
  }

  .placeholder-icon .icon { width: 36px; height: 36px; color: var(--text-muted); }

  .placeholder-page h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 28px;
    font-weight: 400;
    margin-bottom: 12px;
  }

  .placeholder-page p {
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 32px;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fade-in { animation: fadeIn 0.35s ease; }

  /* â”€â”€â”€ REVIEW MODE â”€â”€â”€ */
  .review-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .review-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 32px;
  }

  .review-dot {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: all 0.15s;
  }

  .review-dot.correct { background: var(--green-bg); color: var(--green); border: 1px solid rgba(34,197,94,0.3); }
  .review-dot.incorrect { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }
  .review-dot.current { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* â”€â”€ Oral Accordion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  .oral-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  .gravity-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 5px solid var(--bar-color, var(--border));
    border-radius: var(--radius-sm);
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .gravity-bar:hover { background: var(--bg-card-hover); }
  .gravity-bar .bar-label {
    font-weight: 700;
    font-size: 14px;
    min-width: 28px;
  }
  .gravity-bar .bar-title {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
    flex: 1;
  }
  .gravity-bar .bar-tagline {
    font-size: 12px;
    color: var(--text-dim);
  }
  .gravity-bar .bar-chevron {
    transition: transform 0.25s;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .gravity-bar .bar-chevron.open { transform: rotate(180deg); }

  .topic-list {
    margin: 0 0 8px 0;
    padding: 0 0 0 22px;
    border-left: 3px solid var(--bar-color, var(--border));
    margin-left: 10px;
  }

  .topic-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .topic-row:hover { background: var(--bg-card-hover); }
  .topic-row .topic-letter {
    font-weight: 700;
    font-size: 14px;
    color: var(--bar-color, var(--accent));
    min-width: 20px;
  }
  .topic-row .topic-title {
    font-size: 14px;
    color: var(--text);
    flex: 1;
  }
  .topic-row .topic-desc {
    font-size: 11px;
    color: var(--text-dim);
  }
  .topic-row .topic-chevron {
    transition: transform 0.25s;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .topic-row .topic-chevron.open { transform: rotate(180deg); }
  .topic-row .q-count {
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  .subtopic-list {
    padding: 0 0 0 20px;
    margin: 0 0 4px 0;
  }

  .subtopic-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: 3px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .subtopic-row:hover { background: var(--bg-card); }
  .subtopic-row .sub-letter {
    font-weight: 600;
    font-size: 13px;
    color: var(--bar-color, var(--accent));
    min-width: 16px;
  }
  .subtopic-row .sub-title {
    font-size: 13px;
    color: var(--text);
    flex: 1;
  }
  .subtopic-row .q-count {
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  /* â”€â”€ Oral Question Viewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  .oral-viewer {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  .oral-q-counter {
    font-size: 13px;
    color: var(--text-dim);
    margin-bottom: 8px;
  }

  .oral-q-text {
    font-size: 17px;
    line-height: 1.7;
    color: var(--text);
    margin-bottom: 28px;
    font-weight: 500;
  }

  .answer-box {
    min-height: 180px;
    background: var(--bg-surface);
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 24px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    margin-bottom: 24px;
  }
  .answer-box .answer-placeholder {
    color: var(--text-dim);
    font-size: 14px;
    text-align: center;
  }
  .answer-box.revealed {
    border-style: solid;
    border-color: rgba(99,102,241,0.3);
    background: rgba(99,102,241,0.06);
    align-items: flex-start;
    justify-content: flex-start;
  }
  .answer-box .answer-content {
    color: var(--text);
    font-size: 15px;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .oral-source {
    font-size: 12px;
    color: var(--text-dim);
    margin-top: -20px;
    margin-bottom: 24px;
    font-style: italic;
  }

  /* â”€â”€ Oral Reference Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  .ref-table {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  .ref-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
    background: var(--bg-card);
  }
  .ref-row:nth-child(even) { background: var(--bg-surface); }
  .ref-row .ref-topic {
    font-size: 14px;
    color: var(--text);
    flex: 1;
    padding-right: 12px;
  }
  .ref-row .ref-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .home-title { font-size: 32px; }
    .profile-form { flex-direction: column; }
    .mcq-memory { grid-template-columns: 1fr; }
    .game-hud { grid-template-columns: repeat(2, 1fr); }
    .nav-bar { gap: 6px; padding: 12px 16px; }
    .nav-btn { padding: 8px 12px; font-size: 13px; }
    .sprint-auto-toggle { right: 12px; bottom: 68px; }
  }
`;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function ProfileScreen({ profileStore, syncStatus, syncMessage, onSelectProfile, onCreateProfile }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profiles = Object.values(profileStore.profiles)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = normalizeProfileName(username);

    if (name.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    if (name.length > 32) {
      setError("Please keep the username under 32 characters.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await onCreateProfile(name);
      setUsername("");
    } catch (err) {
      setError(err.message || "Could not create this profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-screen fade-in">
      <div className="profile-panel">
        <h1>Choose Profile</h1>
        <p>Create or select a study profile. When online sync is configured, progress follows this username across browsers.</p>
        <div className={`sync-status ${syncStatus}`}>
          {syncMessage}
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <input
            className="profile-input"
            value={username}
            onChange={event => {
              setUsername(event.target.value);
              setError("");
            }}
            placeholder="Username"
            autoFocus
          />
          <button className="results-btn primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
        {error && <div className="profile-error">{error}</div>}

        {profiles.length > 0 && (
          <div className="profile-list">
            <div className="profile-list-title">Existing profiles</div>
            {profiles.map(profile => {
              const summary = summarizeMcqProgress(profile.mcqProgress || createEmptyMcqProgress());
              return (
                <button
                  key={profile.id}
                  className="profile-btn"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <span>{profile.name}</span>
                  <small>{summary.mastered} mastered Â· {summary.review} review</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeScreen({ onNavigate, profileName, onSwitchProfile }) {
  const sections = [
    { id: 'mcq', icon: <Icons.ClipboardCheck />, iconClass: 'blue', title: 'MCQ Study', desc: 'Gamified multiple-choice practice with saved mastery progress', active: true },
    { id: 'oral', icon: <Icons.Mic />, iconClass: 'purple', title: 'Oral Examination Questions', desc: 'Oral exam practice organized by topic priority', active: true },
  ];

  return (
    <div className="home fade-in">
      <div className="home-header">
        <div className="home-logo"><Icons.Brain /></div>
        <h1 className="home-title">Psychiatry Specialty Exam</h1>
        <p className="home-subtitle">Study companion for MCQ and oral preparation</p>
        <div className="profile-bar">
          <span>{profileName}</span>
          <button className="profile-switch" onClick={onSwitchProfile}>Switch profile</button>
        </div>
      </div>
      <div className="grid">
        {sections.map(s => (
          <div
            key={s.id}
            className={`card full-width ${!s.active ? 'disabled' : ''}`}
            onClick={() => s.active && onNavigate(s.id)}
          >
            <div className={`card-icon ${s.iconClass} card-icon-lg`}>{s.icon}</div>
            <div className="card-title" style={{fontSize:19}}>{s.title}</div>
            <div className="card-desc">{s.desc}</div>
            {!s.active && <span className="card-badge">Soon</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function McqSelect({ onBack, onStart, onHome, progressSummary, onResetProgress }) {
  return (
    <div className="mcq-select fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:32}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Back
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
      </div>
      <h2>MCQ Study</h2>
      <p>Choose a gamified practice mode. All modes update the same mastery memory.</p>

      <div className="mcq-memory" aria-label="MCQ progress">
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value">{progressSummary.mastered}</span>
          <span className="mcq-memory-label">Mastered</span>
        </div>
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value">{progressSummary.review}</span>
          <span className="mcq-memory-label">Review</span>
        </div>
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value">{progressSummary.unseen}</span>
          <span className="mcq-memory-label">Unseen</span>
        </div>
      </div>

      <button className="mode-btn featured" onClick={() => onStart('daily')}>
        Daily
        <small>Spaced repetition, weak questions, mastered maintenance, and a little novelty.</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('random')}>
        Random
        <small>Relaxed mixed practice through the full question bank, shuffled each time.</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('sprint')}>
        Sprint
        <small>10 timed unseen-first questions, 30 seconds each, with speed and streak points.</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('weakness')}>
        Weakness
        <small>Targets repeatedly wrong, confidently wrong, low mastery, and due questions.</small>
      </button>
      {progressSummary.seen > 0 && (
        <button className="reset-progress-btn" onClick={onResetProgress}>
          Reset saved MCQ progress
        </button>
      )}
    </div>
  );
}

function McqTest({ mode, progress, onProgressChange, onBack, onHome }) {
  const sessionIdRef = useRef(`${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const startedAtRef = useRef(Date.now());
  const deadlineRef = useRef(Date.now() + SPRINT_TIME_LIMIT_MS);
  const advanceTimerRef = useRef(null);
  const advancingRef = useRef(false);
  const sessionFinishedRef = useRef(false);
  const [questions, setQuestions] = useState(() => getSessionQuestions(mode, progress));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [timeLeftMs, setTimeLeftMs] = useState(SPRINT_TIME_LIMIT_MS);
  const [lastBreakdown, setLastBreakdown] = useState(null);
  const [finalSprintSession, setFinalSprintSession] = useState(null);
  const [autoAdvanceSprint, setAutoAdvanceSprint] = useState(true);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0,
    currentStreak: 0,
    maxStreak: 0,
    points: 0,
  });
  const q = questions[currentIdx];
  const totalQ = questions.length;
  const selected = answers[q?.id];
  const isLocked = !!locked[q?.id];
  const questionRecord = getQuestionProgress(progress, q?.id);
  const questionStatus = getQuestionStatus(questionRecord);
  const progressStats = summarizeMcqProgress(progress);
  const prevIdx = currentIdx - 1;
  const nextIdx = currentIdx + 1;
  const dailyReason = mode === "daily" && q ? getDailyReason(progress, q.id) : null;
  const sprintSessions = getSprintSessions(progress);
  const previousSprintSessions = finalSprintSession
    ? sprintSessions.filter(session => session.id !== finalSprintSession.id)
    : sprintSessions;
  const sprintHighScore = getSprintHighScore({
    ...progress,
    sprintSessions: previousSprintSessions,
  });
  const latestAttempt = q
    ? (progress.attempts || []).find(attempt =>
        attempt.sessionId === sessionIdRef.current && attempt.questionId === q.id
      )
    : null;
  const displayedBreakdown = lastBreakdown || latestAttempt?.pointBreakdown || (isLocked ? { base: 0, speed: 0, streak: 0, total: 0 } : null);
  const sprintRatio = Math.max(0, Math.min(1, timeLeftMs / SPRINT_TIME_LIMIT_MS));
  const sprintTimerClass = sprintRatio <= 0.25 ? "danger" : sprintRatio <= 0.5 ? "warning" : "";
  const pointTier = displayedBreakdown?.total >= 250
    ? "high"
    : displayedBreakdown?.total >= 100
      ? "medium"
      : "low";
  const modeTitle = {
    daily: "Daily",
    random: "Random",
    sprint: "Sprint",
    weakness: "Weakness",
  }[mode] || "MCQ";

  useEffect(() => {
    if (mode !== "daily") return;
    onProgressChange(prev => ensureDailyChallenge(prev).progress);
  }, [mode, onProgressChange]);

  useEffect(() => {
    if (!q?.id) return;
    startedAtRef.current = Date.now();
    deadlineRef.current = Date.now() + SPRINT_TIME_LIMIT_MS;
    advancingRef.current = false;
    setLastBreakdown(null);
    setTimeLeftMs(SPRINT_TIME_LIMIT_MS);
    onProgressChange(prev => markQuestionSeen(prev, q.id));
  }, [q?.id]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const finishSprint = useCallback((finalStats) => {
    if (mode !== "sprint" || sessionFinishedRef.current) return;

    sessionFinishedRef.current = true;
    const session = {
      id: sessionIdRef.current,
      completedAt: new Date().toISOString(),
      totalQuestions: totalQ,
      correct: finalStats.correct,
      incorrect: finalStats.incorrect,
      points: finalStats.points,
      maxStreak: finalStats.maxStreak,
      accuracy: finalStats.total > 0 ? Math.round((finalStats.correct / finalStats.total) * 100) : 0,
    };

    setFinalSprintSession(session);
    onProgressChange(prev => recordSprintSession(prev, session));
  }, [mode, onProgressChange, totalQ]);

  const advanceSprint = useCallback((finalStats) => {
    if (mode !== "sprint") return;

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (currentIdx >= totalQ - 1) {
        finishSprint(finalStats);
        return;
      }

      setCurrentIdx(index => Math.min(index + 1, totalQ - 1));
    }, 900);
  }, [currentIdx, finishSprint, mode, totalQ]);

  const goToNextQuestion = useCallback(() => {
    if (mode === "sprint") {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (currentIdx >= totalQ - 1) {
        finishSprint(sessionStats);
        return;
      }
      setCurrentIdx(index => Math.min(index + 1, totalQ - 1));
      return;
    }

    setCurrentIdx(nextIdx);
  }, [currentIdx, finishSprint, mode, nextIdx, sessionStats, totalQ]);

  const submitAnswer = useCallback((selectedOverride = selected, timedOut = false) => {
    if ((selectedOverride === undefined || selectedOverride === null) && !timedOut) return;
    if (isLocked || !q) return;
    if (mode === "sprint" && (advancingRef.current || finalSprintSession)) return;

    const isCorrect = selectedOverride === q.correct;
    const nextStreak = isCorrect ? sessionStats.currentStreak + 1 : 0;
    const timeTakenMs = Math.max(0, Date.now() - startedAtRef.current);
    const inferredConfidence = inferAnswerConfidence({
      mode,
      timeTakenMs,
      timeLimitMs: SPRINT_TIME_LIMIT_MS,
      isCorrect,
    });
    const pointBreakdown = mode === "sprint"
      ? calculateSprintPoints({ isCorrect, timeTakenMs, timeLimitMs: SPRINT_TIME_LIMIT_MS, currentStreak: nextStreak })
      : calculateStandardPoints({ isCorrect, mode, currentStreak: nextStreak });
    const nextStats = {
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      incorrect: sessionStats.incorrect + (isCorrect ? 0 : 1),
      total: sessionStats.total + 1,
      currentStreak: nextStreak,
      maxStreak: Math.max(sessionStats.maxStreak, nextStreak),
      points: sessionStats.points + pointBreakdown.total,
    };

    if (mode === "sprint" && autoAdvanceSprint) advancingRef.current = true;
    setLocked(prev => ({ ...prev, [q.id]: true }));
    setLastBreakdown(pointBreakdown);
    setSessionStats(nextStats);
    onProgressChange(prev => recordQuestionAnswer(prev, q, selectedOverride, {
      mode,
      confidence: inferredConfidence,
      timeTakenMs,
      pointsAwarded: pointBreakdown.total,
      pointBreakdown,
      sessionId: sessionIdRef.current,
      streakPosition: nextStreak,
    }));

    if (mode === "sprint" && autoAdvanceSprint) advanceSprint(nextStats);
  }, [selected, isLocked, q, sessionStats, mode, onProgressChange, autoAdvanceSprint, advanceSprint, finalSprintSession]);

  useEffect(() => {
    if (mode !== "sprint" || isLocked || !q || finalSprintSession) return;

    const intervalId = setInterval(() => {
      setTimeLeftMs(Math.max(0, deadlineRef.current - Date.now()));
    }, 100);

    return () => clearInterval(intervalId);
  }, [mode, isLocked, q?.id, finalSprintSession]);

  useEffect(() => {
    if (
      mode === "sprint" &&
      timeLeftMs <= 0 &&
      Date.now() >= deadlineRef.current &&
      !isLocked &&
      q &&
      !finalSprintSession
    ) {
      submitAnswer(null, true);
    }
  }, [timeLeftMs, mode, isLocked, q?.id, submitAnswer, finalSprintSession]);

  const selectOption = (idx) => {
    if (isLocked) return;
    setAnswers(prev => ({ ...prev, [q.id]: idx }));
  };

  const restartSprint = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    sessionIdRef.current = `${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionFinishedRef.current = false;
    advancingRef.current = false;
    startedAtRef.current = Date.now();
    deadlineRef.current = Date.now() + SPRINT_TIME_LIMIT_MS;
    setQuestions(getSessionQuestions(mode, progress));
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setLastBreakdown(null);
    setFinalSprintSession(null);
    setTimeLeftMs(SPRINT_TIME_LIMIT_MS);
    setSessionStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      currentStreak: 0,
      maxStreak: 0,
      points: 0,
    });
  };

  if (!q) {
    return (
      <div className="test-container fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <div className="explanation-box">
          <strong>No questions in this mode yet</strong>
          Weakness mode will fill after this profile has wrong or high-risk answers to review.
        </div>
      </div>
    );
  }

  return (
    <div className="test-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <button className="back-link" style={{ marginBottom: 0 }} onClick={onBack}>
          <Icons.ChevronLeft /> MCQ Menu
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
      </div>

      <div className="game-hud">
        <div className="hud-stat">
          <span className="hud-value">{mode === "sprint" ? Math.ceil(timeLeftMs / 1000) : sessionStats.currentStreak}</span>
          <span className="hud-label">{mode === "sprint" ? "Seconds" : "Streak"}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-value">{mode === "sprint" ? sessionStats.points : sessionStats.correct}</span>
          <span className="hud-label">{mode === "sprint" ? "Points" : "Correct"}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-value">{mode === "sprint" ? sessionStats.currentStreak : sessionStats.incorrect}</span>
          <span className="hud-label">{mode === "sprint" ? "Streak" : "Incorrect"}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-value">{sessionStats.total}</span>
          <span className="hud-label">Answered</span>
        </div>
      </div>

      {mode === "sprint" && (
        <div className="sprint-timer-track" aria-label="Sprint countdown">
          <div
            className={`sprint-timer-fill ${sprintTimerClass}`}
            style={{ width: `${sprintRatio * 100}%` }}
          />
        </div>
      )}

      <div className="test-header">
        <span className="progress-text">
          Mastered {progressStats.mastered}/{progressStats.total}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(progressStats.mastered / progressStats.total) * 100}%` }} />
        </div>
        <span className="progress-text">
          {modeTitle} {currentIdx + 1}/{totalQ}
        </span>
      </div>

      <div className="question-num">
        Question {q.id}
        <span className={`question-status ${questionStatus.toLowerCase()}`}>{questionStatus}</span>
        {dailyReason && <span className="question-status seen">{getDailyReasonLabel(dailyReason)}</span>}
      </div>
      <div className="question-stem">{q.stem}</div>

      <div className="options-list">
        {q.options.map((opt, i) => {
          const letter = String.fromCharCode(913 + i);
          let cls = 'option-btn';
          if (isLocked) {
            cls += ' locked';
            if (i === q.correct)                       cls += ' correct';
            else if (i === selected && i !== q.correct) cls += ' incorrect';
          } else if (i === selected) cls += ' selected';
          return (
            <button key={i} className={cls} onClick={() => selectOption(i)}>
              <span className="option-letter">
                {isLocked && i === q.correct ? <Icons.Check /> :
                 isLocked && i === selected && i !== q.correct ? <Icons.X /> : letter}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {isLocked && (
        <div className="explanation-box">
          <strong>Explanation</strong>{q.explanation}
          {displayedBreakdown && (
            <div className={`point-breakdown ${pointTier}`}>
              <span className="point-pill">Correct +{displayedBreakdown.base}</span>
              {mode === "sprint" && <span className="point-pill">Speed +{displayedBreakdown.speed}</span>}
              <span className="point-pill">Streak +{displayedBreakdown.streak}</span>
              <span className="point-pill total">Total +{displayedBreakdown.total}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 80 }} />

      {mode === "sprint" && (
        <button
          className={`sprint-auto-toggle ${autoAdvanceSprint ? "active" : ""}`}
          onClick={() => setAutoAdvanceSprint(value => !value)}
          title="Toggle automatic movement after each Sprint answer"
        >
          Auto-advance {autoAdvanceSprint ? "On" : "Off"}
        </button>
      )}

      <div className="nav-bar">
        <button className="nav-btn" onClick={() => setCurrentIdx(prevIdx)} disabled={mode === "sprint" || prevIdx < 0}>
          <Icons.ChevronLeft />
        </button>
        {!isLocked && (
          <button className="nav-btn primary" onClick={() => submitAnswer()} disabled={selected === undefined}>
            <Icons.Lock /> Lock
          </button>
        )}
        <button
          className="nav-btn"
          onClick={goToNextQuestion}
          disabled={mode === "sprint" ? !isLocked : nextIdx < 0 || nextIdx >= totalQ}
        >
          {mode === "sprint" && isLocked
            ? currentIdx >= totalQ - 1 ? "Finish" : "Next"
            : <Icons.ChevronRight />}
        </button>
      </div>

      {finalSprintSession && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Sprint results">
          <div className="modal sprint-results-modal">
            <h3>Sprint complete</h3>
            <div className="sprint-score">{finalSprintSession.points}</div>
            <div className="sprint-result-grid">
              <div className="sprint-result-stat">
                <strong>{finalSprintSession.correct}/{finalSprintSession.totalQuestions}</strong>
                <span>Correct</span>
              </div>
              <div className="sprint-result-stat">
                <strong>{finalSprintSession.accuracy}%</strong>
                <span>Accuracy</span>
              </div>
              <div className="sprint-result-stat">
                <strong>{finalSprintSession.maxStreak}</strong>
                <span>Best streak</span>
              </div>
            </div>
            <p>
              {finalSprintSession.points > sprintHighScore
                ? "New high score for this profile."
                : sprintHighScore > 0
                  ? `Profile high score: ${sprintHighScore} points.`
                  : "This is the first saved Sprint for this profile."}
            </p>
            <div className="sprint-history">
              <div className="sprint-history-title">Previous scores</div>
              {previousSprintSessions.length === 0 ? (
                <div className="sprint-history-row">
                  <span>No previous Sprint scores yet</span>
                  <strong>-</strong>
                </div>
              ) : (
                previousSprintSessions.slice(0, 5).map(session => (
                  <div className="sprint-history-row" key={session.id}>
                    <span>{new Date(session.completedAt).toLocaleDateString()}</span>
                    <strong>{session.points} pts</strong>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="results-btn primary" onClick={restartSprint}>
                Go again
              </button>
              <button className="results-btn" onClick={onBack}>
                MCQ menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ORAL EXAMINATION COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function OralAccordion({ onBack, onHome, onNavigateToViewer, onNavigateToTable }) {
  const [expandedGravity, setExpandedGravity] = useState({});
  const [expandedTopic, setExpandedTopic] = useState({});

  const toggleGravity = (id) => {
    setExpandedGravity(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTopic = (id) => {
    setExpandedTopic(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const countQuestions = (topic) => {
    if (topic.subtopics) {
      return topic.subtopics.reduce((sum, st) => sum + st.questions.length, 0);
    }
    return topic.questions?.length || 0;
  };

  return (
    <div className="oral-container fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Î Î¯ÏƒÏ‰
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Î‘ÏÏ‡Î¹ÎºÎ®
        </button>
      </div>
      <h2 style={{textAlign:'center', marginBottom:6, fontSize:22}}>Oral Examination Questions</h2>
      <p style={{textAlign:'center', color:'var(--text-dim)', fontSize:13, marginBottom:28}}>Î•ÏÏ‰Ï„Î®ÏƒÎµÎ¹Ï‚ ÎºÎ±Ï„Î¬ Î²Î±ÏÏÏ„Î·Ï„Î± Î¸Î­Î¼Î±Ï„Î¿Ï‚</p>

      {oralData.map(gravity => (
        <div key={gravity.id}>
          <div
            className="gravity-bar"
            style={{'--bar-color': gravity.color}}
            onClick={() => {
              if (gravity.isTable) {
                onNavigateToTable(gravity.rows);
              } else {
                toggleGravity(gravity.id);
              }
            }}
          >
            <span className="bar-label" style={{color: gravity.color}}>{gravity.label}</span>
            <span className="bar-title">{gravity.title}</span>
            <span className="bar-tagline">{gravity.tagline}</span>
            {!gravity.isTable && (
              <span className={`bar-chevron ${expandedGravity[gravity.id] ? 'open' : ''}`}>
                <Icons.ChevronDown />
              </span>
            )}
            {gravity.isTable && (
              <span style={{color:'var(--text-dim)'}}><Icons.ChevronRight /></span>
            )}
          </div>

          {expandedGravity[gravity.id] && gravity.topics && (
            <div className="topic-list" style={{'--bar-color': gravity.color}}>
              {gravity.topics.map(topic => (
                <div key={topic.id}>
                  <div
                    className="topic-row"
                    style={{'--bar-color': gravity.color}}
                    onClick={() => {
                      if (topic.subtopics) {
                        toggleTopic(topic.id);
                      } else {
                        onNavigateToViewer(topic.questions, `${gravity.label} ${topic.letter}. ${topic.title}`);
                      }
                    }}
                  >
                    <span className="topic-letter">{topic.letter}.</span>
                    <div style={{flex:1}}>
                      <div className="topic-title">{topic.title}</div>
                      {topic.description && <div className="topic-desc">{topic.description}</div>}
                    </div>
                    <span className="q-count">{countQuestions(topic)} ÎµÏ.</span>
                    {topic.subtopics ? (
                      <span className={`topic-chevron ${expandedTopic[topic.id] ? 'open' : ''}`}>
                        <Icons.ChevronDown />
                      </span>
                    ) : (
                      <span style={{color:'var(--text-dim)'}}><Icons.ChevronRight /></span>
                    )}
                  </div>

                  {topic.subtopics && expandedTopic[topic.id] && (
                    <div className="subtopic-list" style={{'--bar-color': gravity.color}}>
                      {topic.subtopics.map(sub => (
                        <div
                          key={sub.id}
                          className="subtopic-row"
                          style={{'--bar-color': gravity.color}}
                          onClick={() => onNavigateToViewer(sub.questions, `${gravity.label} ${topic.letter}.${sub.letter}. ${sub.title}`)}
                        >
                          <span className="sub-letter">{sub.letter}.</span>
                          <span className="sub-title">{sub.title}</span>
                          <span className="q-count">{sub.questions.length} ÎµÏ.</span>
                          <span style={{color:'var(--text-dim)'}}><Icons.ChevronRight /></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OralQuestionViewer({ questions, title, onBack, onHome }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const q = questions[currentIdx];
  const total = questions.length;

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setShowAnswer(false);
    }
  };

  const goNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowAnswer(false);
    }
  };

  return (
    <div className="oral-viewer fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Î Î¯ÏƒÏ‰
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Î‘ÏÏ‡Î¹ÎºÎ®
        </button>
      </div>

      <p style={{fontSize:13, color:'var(--text-dim)', marginBottom:4}}>{title}</p>
      <div className="oral-q-counter">Î•ÏÏŽÏ„Î·ÏƒÎ· {currentIdx + 1} / {total}</div>

      <div className="oral-q-text">{q.text}</div>

      {q.source && <div className="oral-source">{q.source}</div>}

      <div
        className={`answer-box ${showAnswer ? 'revealed' : ''}`}
        onClick={() => setShowAnswer(!showAnswer)}
      >
        {!showAnswer ? (
          <div className="answer-placeholder">
            <Icons.Eye />
            <div style={{marginTop:8}}>Î Î±Ï„Î®ÏƒÏ„Îµ Î³Î¹Î± Î½Î± Î´ÎµÎ¯Ï„Îµ Ï„Î·Î½ Î±Ï€Î¬Î½Ï„Î·ÏƒÎ·</div>
          </div>
        ) : (
          <div className="answer-content">{q.answer}</div>
        )}
      </div>

      <div style={{ height: 80 }} />

      <div className="nav-bar">
        <button className="nav-btn" onClick={goPrev} disabled={currentIdx === 0}>
          <Icons.ChevronLeft /> Î ÏÎ¿Î·Î³Î¿ÏÎ¼ÎµÎ½Î·
        </button>
        <button className="nav-btn" onClick={goNext} disabled={currentIdx === total - 1}>
          Î•Ï€ÏŒÎ¼ÎµÎ½Î· <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}

function OralTable({ rows, onBack, onHome }) {
  return (
    <div className="ref-table fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Î Î¯ÏƒÏ‰
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Î‘ÏÏ‡Î¹ÎºÎ®
        </button>
      </div>
      <h2 style={{textAlign:'center', marginBottom:6, fontSize:20}}>Î“ÏÎ®Î³Î¿ÏÎµÏ‚ Î‘Ï€Î±Î½Ï„Î®ÏƒÎµÎ¹Ï‚</h2>
      <p style={{textAlign:'center', color:'var(--text-dim)', fontSize:13, marginBottom:24}}>Î‘ÏÎ¹Î¸Î¼Î¿Î¯ Ï€Î¿Ï… Ï€ÏÎ­Ï€ÎµÎ¹ Î½Î± Î¾Î­ÏÎµÎ¹Ï‚</p>

      {rows.map((row, i) => (
        <div key={i} className="ref-row">
          <span className="ref-topic">{row.topic}</span>
          <span className="ref-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderPage({ title, description, icon, onBack, onHome }) {
  return (
    <div className="placeholder-page fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Î Î¯ÏƒÏ‰
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Î‘ÏÏ‡Î¹ÎºÎ®
        </button>
      </div>
      <div className="placeholder-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="results-btn" onClick={onBack}>
        Î•Ï€Î¹ÏƒÏ„ÏÎ¿Ï†Î® ÏƒÏ„Î·Î½ Î‘ÏÏ‡Î¹ÎºÎ®
      </button>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function App() {
  const [screen, setScreen] = useState('home');
  const [testMode, setTestMode] = useState(null);
  const [oralViewerData, setOralViewerData] = useState(null);
  const [oralTableData, setOralTableData] = useState(null);
  const [profileStore, setProfileStore] = useState(() => loadProfileStore());
  const [syncStatus, setSyncStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  const remoteSaveTimerRef = useRef(null);
  const lastRemoteAttemptIdRef = useRef(null);
  const activeProfile = profileStore.activeProfileId
    ? profileStore.profiles[profileStore.activeProfileId]
    : null;
  const mcqProgress = activeProfile?.mcqProgress || createEmptyMcqProgress();
  const mcqProgressSummary = useMemo(() => summarizeMcqProgress(mcqProgress), [mcqProgress]);
  const syncMessage = useMemo(() => {
    if (!ONLINE_PROFILES_ENABLED) return "Local profiles only. Add Supabase environment variables for online sync.";
    if (syncStatus === "loading") return "Loading online profiles...";
    if (syncStatus === "saving") return "Saving progress online...";
    if (syncStatus === "offline") return "Online sync is unavailable. Changes are cached locally.";
    return "Online profiles enabled";
  }, [syncStatus]);

  useEffect(() => {
    saveProfileStore(profileStore);
  }, [profileStore]);

  useEffect(() => {
    if (!ONLINE_PROFILES_ENABLED) return;

    let cancelled = false;

    async function loadProfiles() {
      setSyncStatus("loading");
      try {
        const remoteStore = await loadRemoteProfileStore(profileStore.activeProfileId);
        if (cancelled) return;
        setProfileStore(prev => ({
          version: 1,
          profiles: {
            ...prev.profiles,
            ...remoteStore.profiles,
          },
          activeProfileId: (prev.profiles[prev.activeProfileId] || remoteStore.profiles[prev.activeProfileId])
            ? prev.activeProfileId
            : remoteStore.activeProfileId,
        }));
        setSyncStatus("online");
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    };
  }, []);

  const queueRemoteProgressSave = useCallback((profileId, progress) => {
    if (!ONLINE_PROFILES_ENABLED || !profileId) return;

    setSyncStatus("saving");
    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveRemoteMcqProgress(profileId, progress);
        const latestAttemptId = progress.attempts?.[0]?.id;
        if (latestAttemptId && latestAttemptId !== lastRemoteAttemptIdRef.current) {
          try {
            await saveRemoteAnswerBehavior(profileId, progress);
          } catch {
            // The normalized gamification tables are optional; the profile JSON remains the source of truth.
          } finally {
            lastRemoteAttemptIdRef.current = latestAttemptId;
          }
        }
        setSyncStatus("online");
      } catch {
        setSyncStatus("offline");
      }
    }, 500);
  }, []);

  const selectProfile = useCallback(async (profileId) => {
    const profile = profileStore.profiles[profileId];
    setScreen('home');
    setTestMode(null);
    setProfileStore(prev => ({
      ...prev,
      activeProfileId: prev.profiles[profileId] ? profileId : prev.activeProfileId,
    }));

    if (ONLINE_PROFILES_ENABLED && profile) {
      setSyncStatus("saving");
      try {
        await upsertRemoteProfile(profile);
        setSyncStatus("online");
      } catch {
        setSyncStatus("offline");
      }
    }
  }, [profileStore.profiles]);

  const createOrSelectProfile = useCallback(async (name) => {
    const profileId = getProfileId(name);
    const existing = profileStore.profiles[profileId];
    const legacyProgress = !existing && Object.keys(profileStore.profiles).length === 0
      ? loadMcqProgress()
      : createEmptyMcqProgress();
    const hasLegacyProgress = Object.keys(legacyProgress.questions || {}).length > 0;
    const profileToSync = existing || createStudyProfile(
      name,
      hasLegacyProgress ? legacyProgress : createEmptyMcqProgress()
    );

    setScreen('home');
    setTestMode(null);
    setProfileStore(prev => ({
      ...prev,
      activeProfileId: profileId,
      profiles: {
        ...prev.profiles,
        [profileId]: profileToSync,
      },
    }));

    if (ONLINE_PROFILES_ENABLED && profileToSync) {
      setSyncStatus("saving");
      try {
        const remoteProfile = await upsertRemoteProfile(profileToSync);
        setProfileStore(prev => ({
          ...prev,
          activeProfileId: remoteProfile.id,
          profiles: {
            ...prev.profiles,
            [remoteProfile.id]: remoteProfile,
          },
        }));
        setSyncStatus("online");
      } catch (err) {
        setSyncStatus("offline");
        throw err;
      }
    }
  }, [profileStore.profiles]);

  const updateMcqProgress = useCallback((nextOrUpdater) => {
    const profileId = profileStore.activeProfileId;
    const profile = profileId ? profileStore.profiles[profileId] : null;
    if (!profile) return;

    const currentProgress = profile.mcqProgress || createEmptyMcqProgress();
    const nextProgress = typeof nextOrUpdater === "function"
      ? nextOrUpdater(currentProgress)
      : nextOrUpdater;

    setProfileStore(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [profileId]: {
          ...prev.profiles[profileId],
          mcqProgress: nextProgress,
        },
      },
    }));
    queueRemoteProgressSave(profileId, nextProgress);
  }, [profileStore.activeProfileId, profileStore.profiles, queueRemoteProgressSave]);

  const resetMcqProgress = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("Reset MCQ progress for this profile?")) return;
    const profileId = profileStore.activeProfileId;
    updateMcqProgress(createResetMcqProgress());
    if (ONLINE_PROFILES_ENABLED && profileId) {
      deleteRemoteQuestionBehavior(profileId).catch(() => {
        // The profile reset still wins because resetAt prevents older question-state rows from hydrating.
      });
    }
  }, [profileStore.activeProfileId, updateMcqProgress]);

  const switchProfile = useCallback(() => {
    setScreen('home');
    setTestMode(null);
    setProfileStore(prev => ({ ...prev, activeProfileId: null }));
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {!activeProfile && (
          <ProfileScreen
            profileStore={profileStore}
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            onSelectProfile={selectProfile}
            onCreateProfile={createOrSelectProfile}
          />
        )}
        {activeProfile && screen === 'home' && (
          <HomeScreen
            onNavigate={(id) => setScreen(id)}
            profileName={activeProfile.name}
            onSwitchProfile={switchProfile}
          />
        )}
        {activeProfile && screen === 'mcq' && !testMode && (
          <McqSelect
            onBack={() => setScreen('home')}
            onStart={(mode) => setTestMode(mode)}
            onHome={() => setScreen('home')}
            progressSummary={mcqProgressSummary}
            onResetProgress={resetMcqProgress}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode && (
          <McqTest
            mode={testMode}
            progress={mcqProgress}
            onProgressChange={updateMcqProgress}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'oral' && (
          <OralAccordion
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
            onNavigateToViewer={(questions, title) => {
              setOralViewerData({ questions, title });
              setScreen('oral-viewer');
            }}
            onNavigateToTable={(rows) => {
              setOralTableData(rows);
              setScreen('oral-table');
            }}
          />
        )}
        {activeProfile && screen === 'oral-viewer' && oralViewerData && (
          <OralQuestionViewer
            questions={oralViewerData.questions}
            title={oralViewerData.title}
            onBack={() => setScreen('oral')}
            onHome={() => { setOralViewerData(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'oral-table' && oralTableData && (
          <OralTable
            rows={oralTableData}
            onBack={() => setScreen('oral')}
            onHome={() => { setOralTableData(null); setScreen('home'); }}
          />
        )}
      </div>
    </>
  );
}

