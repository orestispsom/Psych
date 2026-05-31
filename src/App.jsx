import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import QUESTIONS from "./data/questions.js";
import oralData from "./data/oral.js";
import oralCoreQuestions from "./data/oralCore.js";
import { sosNumbers, sosCriticalTopics, sosDifferentialDiagnosis } from "./data/sos.js";

// ═══════════════════════════════════════════════════════════════
// RANDOM QUESTION SELECTION
// ═══════════════════════════════════════════════════════════════

function selectRandomQuestions(count) {
  const arr = [...QUESTIONS];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.slice(0, Math.min(count, arr.length));
}

function shuffleItems(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
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
const WRITTEN_EXAM_SIZE = 100;
const SPRINT_TIME_LIMIT_MS = 30000;
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
const MCQ_FEEDBACK_OPTIONS = [
  { value: "duplicate", label: "Duplicate" },
  { value: "too_easy_wording", label: "Υπερβολικά εύκολη διατύπωση" },
  { value: "wrong_terminology", label: "Λάθος ορολογία" },
  { value: "wrong_or_uncertain_answer", label: "Λάθος/Αμφίβολη Απάντηση" },
];
const WRITTEN_WEAK_AREA_LABELS = [
  "diagnostic exclusion",
  "risk assessment",
  "emergency psychiatry",
  "psychopharmacology sequencing",
  "capacity / legal issues",
  "differential diagnosis",
  "organic and substance-induced disorders",
  "management decisiveness",
  "adverse effects and monitoring",
  "over-nuance traps",
];

function createEmptyOralProgress() {
  return {
    version: 1,
    mastered: {},
    updatedAt: null,
  };
}

function normalizeOralProgress(progress) {
  const empty = createEmptyOralProgress();
  if (!progress || typeof progress !== "object") return empty;

  const mastered = progress.mastered && typeof progress.mastered === "object"
    ? Object.fromEntries(
        Object.entries(progress.mastered).filter(([, value]) => Boolean(value))
      )
    : {};

  return {
    ...empty,
    ...progress,
    version: 1,
    mastered,
  };
}

function createEmptySosProgress() {
  return {
    version: 1,
    mastered: {
      critical_topics: {},
      differential_diagnosis: {},
    },
    updatedAt: null,
  };
}

function normalizeSosProgress(progress) {
  const empty = createEmptySosProgress();
  if (!progress || typeof progress !== "object") return empty;

  const mastered = progress.mastered && typeof progress.mastered === "object"
    ? progress.mastered
    : {};

  return {
    ...empty,
    ...progress,
    version: 1,
    mastered: {
      critical_topics: Object.fromEntries(
        Object.entries(mastered.critical_topics || {}).filter(([, value]) => Boolean(value))
      ),
      differential_diagnosis: Object.fromEntries(
        Object.entries(mastered.differential_diagnosis || {}).filter(([, value]) => Boolean(value))
      ),
    },
  };
}

function summarizeSosProgress(sosProgress, section, entries) {
  const mastered = normalizeSosProgress(sosProgress).mastered[section] || {};
  return {
    mastered: entries.reduce((sum, entry) => sum + (mastered[entry.id] ? 1 : 0), 0),
    total: entries.length,
  };
}

function getOralQuestionsFromTopic(topic) {
  if (topic.subtopics) {
    return topic.subtopics.flatMap(subtopic => subtopic.questions || []);
  }
  return topic.questions || [];
}

function getOralQuestionsFromGravity(gravity) {
  return (gravity.topics || []).flatMap(getOralQuestionsFromTopic);
}

function countMasteredOralQuestions(questions, oralProgress) {
  const mastered = normalizeOralProgress(oralProgress).mastered;
  return questions.reduce((sum, question) => sum + (mastered[question.id] ? 1 : 0), 0);
}

function summarizeOralProgress(oralProgress, questions = null) {
  const targetQuestions = questions || oralData.flatMap(getOralQuestionsFromGravity);
  return {
    mastered: countMasteredOralQuestions(targetQuestions, oralProgress),
    total: targetQuestions.length,
  };
}

function getOralQuestionRole(question) {
  return question?.role || "anchor";
}

function getOralQuestionDifficulty(question) {
  return question?.difficulty || "core";
}

function flattenOralQuestionBank() {
  return oralData.flatMap(gravity =>
    (gravity.topics || []).flatMap(topic => {
      const topicQuestions = [];
      const addQuestions = (questions, subtopic = null) => {
        (questions || []).forEach(question => {
          topicQuestions.push({
            ...question,
            role: getOralQuestionRole(question),
            difficulty: getOralQuestionDifficulty(question),
            followUpType: question.followUpType || null,
            linkedAnchorIds: Array.isArray(question.linkedAnchorIds) ? question.linkedAnchorIds : [],
            followUpQuestionIds: Array.isArray(question.followUpQuestionIds) ? question.followUpQuestionIds : [],
            relatedQuestionIds: Array.isArray(question.relatedQuestionIds) ? question.relatedQuestionIds : [],
            trigger: question.trigger || "always",
            oralContext: {
              gravityId: gravity.id,
              gravityLabel: gravity.label,
              gravityTitle: gravity.title,
              topicId: topic.id,
              topicTitle: topic.title,
              subtopicId: subtopic?.id || null,
              subtopicTitle: subtopic?.title || null,
            },
          });
        });
      };

      if (topic.subtopics) {
        topic.subtopics.forEach(subtopic => addQuestions(subtopic.questions, subtopic));
      } else {
        addQuestions(topic.questions);
      }

      return topicQuestions;
    })
  );
}

function getRelatedOralFollowUps(anchor, allQuestions, maxCount = 2) {
  const explicitIds = Array.isArray(anchor.followUpQuestionIds) ? anchor.followUpQuestionIds : [];
  const explicit = explicitIds
    .map(id => allQuestions.find(question => question.id === id))
    .filter(Boolean);
  if (explicit.length) return explicit.slice(0, maxCount);

  return allQuestions
    .filter(question => question.id !== anchor.id)
    .filter(question => {
      if (Array.isArray(question.linkedAnchorIds) && question.linkedAnchorIds.includes(anchor.id)) return true;
      if (question.oralContext?.subtopicId && question.oralContext.subtopicId === anchor.oralContext?.subtopicId) return true;
      return question.oralContext?.topicId && question.oralContext.topicId === anchor.oralContext?.topicId;
    })
    .slice(0, maxCount);
}

const MAJOR_ORAL_EXAM_TOPICS = new Set([
  "Ψυχωτικές διαταραχές",
  "Διαταραχές διάθεσης",
  "Αγχώδεις διαταραχές",
  "Ιδεοψυχαναγκαστική διαταραχή",
  "Τραύμα και στρες",
]);

function isOralCoreAnchor(question) {
  return ["anchor", "case_anchor", "cross_topic"].includes(question?.role);
}

function getOralCoreFollowUps(anchor) {
  const followUpIds = Array.isArray(anchor.followUpQuestionIds) ? anchor.followUpQuestionIds : [];
  return followUpIds
    .map(id => oralCoreQuestions.find(question => question.id === id))
    .filter(Boolean);
}

function getOralExamQuestionText(question) {
  return question?.question || question?.text || "";
}

function getOralExamQuestionAnswer(question) {
  return question?.answer || "Δεν έχει προστεθεί ακόμη ενδεικτική απάντηση για αυτή την ερώτηση.";
}

function getOralExamQuestionContext(question) {
  if (question?.oralContext) {
    return [
      question.oralContext.topicTitle,
      question.oralContext.subtopicTitle,
    ].filter(Boolean).join(" / ");
  }
  return [question?.topic, question?.subtopic].filter(Boolean).join(" / ");
}

function createOralExamSession() {
  const anchors = oralCoreQuestions.filter(isOralCoreAnchor);
  const majorAnchors = anchors.filter(question => MAJOR_ORAL_EXAM_TOPICS.has(question.topic));
  const selected = [];
  const usedIds = new Set();
  const addAnchor = (anchor) => {
    if (!anchor || usedIds.has(anchor.id)) return;
    selected.push(anchor);
    usedIds.add(anchor.id);
  };

  addAnchor(shuffleItems(majorAnchors)[0]);
  shuffleItems(anchors).forEach(anchor => {
    if (selected.length < 3) addAnchor(anchor);
  });

  return selected.map((anchor, index) => ({
    examinerNumber: index + 1,
    anchor,
    followUps: getOralCoreFollowUps(anchor),
  }));
}

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

function createStudyProfile(
  name,
  mcqProgress = createEmptyMcqProgress(),
  oralProgress = createEmptyOralProgress(),
  sosProgress = createEmptySosProgress()
) {
  const displayName = normalizeProfileName(name);
  return {
    id: getProfileId(displayName),
    name: displayName,
    createdAt: new Date().toISOString(),
    mcqProgress: normalizeMcqProgress(mcqProgress),
    oralProgress: normalizeOralProgress(oralProgress),
    sosProgress: normalizeSosProgress(sosProgress),
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
            oralProgress: normalizeOralProgress(profile.oralProgress),
            sosProgress: normalizeSosProgress(profile.sosProgress),
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
    oralProgress: normalizeOralProgress(row.oral_progress),
    sosProgress: createEmptySosProgress(),
  };
}

function profileToRemoteRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    mcq_progress: normalizeMcqProgress(profile.mcqProgress),
    oral_progress: normalizeOralProgress(profile.oralProgress),
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

async function saveMcqFeedback(questionId, feedbackType, optionalMetadata = {}) {
  return supabaseTableRequest(
    "mcq_feedback",
    {},
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        question_id: String(questionId),
        feedback_type: feedbackType,
        question_text_snapshot: optionalMetadata.questionTextSnapshot || null,
        topic: optionalMetadata.topic || null,
        subtopic: optionalMetadata.subtopic || null,
      }),
    }
  );
}

async function getAllMcqFeedback() {
  return supabaseTableRequest("mcq_feedback", {
    select: "id,question_id,feedback_type,question_text_snapshot,topic,subtopic,created_at",
    order: "created_at.desc",
    limit: "10000",
  });
}

async function getFeedbackForQuestion(questionId) {
  return supabaseTableRequest("mcq_feedback", {
    select: "id,question_id,feedback_type,question_text_snapshot,topic,subtopic,created_at",
    question_id: `eq.${String(questionId)}`,
    order: "created_at.desc",
  });
}

async function loadRemoteSosMastery(profileIds) {
  if (!profileIds.length) return [];

  return supabaseTableRequest("sos_mastery", {
    select: "profile_id,entry_id,section,mastered,mastered_at,updated_at",
    profile_id: `in.(${profileIds.map(quoteSupabaseInValue).join(",")})`,
    limit: "10000",
  });
}

function mergeSosMasteryRowsIntoProfile(profile, rows) {
  if (!rows.length) return profile;

  const progress = normalizeSosProgress(profile.sosProgress);
  const nextMastered = {
    critical_topics: { ...progress.mastered.critical_topics },
    differential_diagnosis: { ...progress.mastered.differential_diagnosis },
  };

  rows.forEach(row => {
    if (!nextMastered[row.section]) return;
    if (row.mastered) {
      nextMastered[row.section][row.entry_id] = true;
    } else {
      delete nextMastered[row.section][row.entry_id];
    }
  });

  return {
    ...profile,
    sosProgress: {
      ...progress,
      mastered: nextMastered,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function saveRemoteSosMastery(profileId, section, entryId, mastered) {
  return supabaseTableRequest(
    "sos_mastery",
    { on_conflict: "profile_id,entry_id" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        profile_id: profileId,
        entry_id: entryId,
        section,
        mastered,
        mastered_at: mastered ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    }
  );
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
  let rows;
  try {
    rows = await supabaseProfilesRequest({
      select: "id,name,mcq_progress,oral_progress,created_at",
      order: "name.asc",
    });
  } catch {
    rows = await supabaseProfilesRequest({
      select: "id,name,mcq_progress,created_at",
      order: "name.asc",
    });
  }
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
  try {
    const sosMasteryRows = await loadRemoteSosMastery(Object.keys(profiles));
    sosMasteryRows.forEach(row => {
      const profile = profiles[row.profile_id];
      if (!profile) return;
      profiles[row.profile_id] = mergeSosMasteryRowsIntoProfile(profile, [row]);
    });
  } catch {
    // SOS mastery is optional until its SQL migration has been applied.
  }
  const activeId = profiles[activeProfileId] ? activeProfileId : null;

  return { version: 1, activeProfileId: activeId, profiles };
}

async function upsertRemoteProfile(profile) {
  let rows;
  try {
    rows = await supabaseProfilesRequest(
      { on_conflict: "id" },
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(profileToRemoteRow(profile)),
      }
    );
  } catch {
    const fallbackRow = profileToRemoteRow(profile);
    delete fallbackRow.oral_progress;
    rows = await supabaseProfilesRequest(
      { on_conflict: "id" },
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(fallbackRow),
      }
    );
  }

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

async function saveRemoteOralProgress(profileId, progress) {
  await supabaseProfilesRequest(
    { id: `eq.${profileId}` },
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        oral_progress: normalizeOralProgress(progress),
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

function getRemoteAttemptsToSync(progress, lastSyncedAttemptId = null) {
  const attempts = progress.attempts || [];
  if (!attempts.length) return [];

  if (lastSyncedAttemptId) {
    const syncedIndex = attempts.findIndex(attempt => attempt.id === lastSyncedAttemptId);
    if (syncedIndex > 0) return attempts.slice(0, syncedIndex);
    if (syncedIndex === 0) return [];
  }

  const latestAttempt = attempts[0];
  if (latestAttempt.mode === "written" && latestAttempt.sessionId) {
    return attempts.filter(attempt => attempt.sessionId === latestAttempt.sessionId);
  }

  return [latestAttempt];
}

async function saveRemoteAnswerBehavior(profileId, progress, lastSyncedAttemptId = null) {
  const attempts = getRemoteAttemptsToSync(progress, lastSyncedAttemptId);
  if (!attempts.length) return;

  const syncedQuestionIds = new Set();

  for (const attempt of attempts) {
    const questionState = progress.questions?.[attempt.questionId];
    if (!questionState) continue;

    if (!syncedQuestionIds.has(attempt.questionId)) {
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
      syncedQuestionIds.add(attempt.questionId);
    }

    await supabaseTableRequest(
      "question_attempts",
      { on_conflict: "profile_id,client_attempt_id" },
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
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

function getQuestionAttempts(progress, questionId) {
  return (progress.attempts || []).filter(attempt => String(attempt.questionId) === String(questionId));
}

function getLatestIncorrectAttempt(progress, questionId) {
  return getQuestionAttempts(progress, questionId).find(attempt => attempt.isCorrect === false) || null;
}

function getRecentDailyQuestionRepeatCount(progress, questionId, recentDays = 14) {
  const now = new Date();
  return Object.values(progress.dailyChallenges || {}).reduce((count, challenge) => {
    if (!challenge?.createdAt || !Array.isArray(challenge.items)) return count;
    const daysSinceChallenge = getDaysSince(challenge.createdAt, now);
    if (daysSinceChallenge === null || daysSinceChallenge > recentDays) return count;
    return count + challenge.items.filter(item => String(item.questionId) === String(questionId)).length;
  }, 0);
}

function scoreQuestionForDailyWrongPriority(question, progress, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const wrongCount = getWrongCount(record);
  const latestIncorrectAttempt = getLatestIncorrectAttempt(progress, question.id);
  if (wrongCount <= 0 && !latestIncorrectAttempt) return -Infinity;

  const lastWrongAt = latestIncorrectAttempt?.attemptedAt || (record.lastCorrect === false ? record.lastAnsweredAt : null);
  const daysSinceWrong = getDaysSince(lastWrongAt, now);
  const weakAreaCount = getQuestionWeakAreaTags(question).length;
  const recentDailyRepeats = getRecentDailyQuestionRepeatCount(progress, question.id);
  let score = 0;

  score += Math.min(wrongCount, 5) * 50;
  if ((record.consecutiveWrong || 0) >= 2) score += 80;
  else if ((record.consecutiveWrong || 0) === 1) score += 45;
  if ((record.confidentWrongCount || 0) > 0) score += Math.min(record.confidentWrongCount, 4) * 25;
  if (weakAreaCount > 0) score += Math.min(weakAreaCount, 3) * 10;
  if (daysSinceWrong === null) score += 10;
  else if (daysSinceWrong <= 1) score += 70;
  else if (daysSinceWrong <= 3) score += 55;
  else if (daysSinceWrong <= 7) score += 40;
  else if (daysSinceWrong <= 21) score += 20;
  else score += 8;
  if (isDue(record, now)) score += 20;

  score -= recentDailyRepeats * 45;

  return score + Math.random() * 6;
}

function selectDailyWrongQuestions(progress, count, usedIds, now = new Date()) {
  return selectUniqueQuestions(
    QUESTIONS
      .map(question => ({
        question,
        score: scoreQuestionForDailyWrongPriority(question, progress, now),
        reason: "repeated_wrong",
      }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score),
    count,
    usedIds
  );
}

function selectDailyReviewQuestions(progress, count, usedIds, now = new Date()) {
  const records = progress.questions || {};
  const dueMastered = QUESTIONS
    .filter(question => isQuestionMastered(records[question.id]) && isDue(records[question.id], now))
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress, now), reason: "mastered_due" }))
    .sort((a, b) => b.score - a.score);
  const dueReview = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress, now), reason: "normal_due" }))
    .filter(item => {
      const record = records[item.question.id];
      const mastery = getMasteryLevel(record);
      return hasSeenQuestion(record) && mastery > 0 && mastery < 5 && isDue(record, now);
    })
    .sort((a, b) => b.score - a.score);
  const weakReview = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForWeakness(question, progress, now), reason: "normal_due" }))
    .filter(item => isWeaknessCandidate(item.question, progress))
    .sort((a, b) => b.score - a.score);
  const novelty = shuffleItems(QUESTIONS)
    .filter(question => !hasSeenQuestion(records[question.id]))
    .map(question => ({ question, reason: "unseen_or_random" }));
  const fallback = shuffleItems(QUESTIONS)
    .map(question => ({ question, reason: "fallback_random" }));

  return selectUniqueQuestions(
    [...dueMastered, ...dueReview, ...weakReview, ...novelty, ...fallback],
    count,
    usedIds
  );
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

function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getQuestionSearchText(question) {
  return normalizeQuestionText([
    question?.stem,
    ...(question?.options || []),
    question?.explanation,
    question?.topic,
    question?.topicTag,
    question?.category,
    question?.weakArea,
    question?.weaknessTag,
    ...(Array.isArray(question?.tags) ? question.tags : []),
  ].filter(Boolean).join(" "));
}

function firstQuestionField(question, keys) {
  for (const key of keys) {
    const value = question?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getQuestionTopic(question) {
  const explicitTopic = firstQuestionField(question, ["topic", "topicTag", "category", "section", "domain"]);
  if (explicitTopic) return explicitTopic;

  const text = getQuestionSearchText(question);
  const topicRules = [
    ["Psychosis and Schizophrenia", /\b(schizo|psychosis|psychotic|delusion|hallucination|clozapine|dopamine|negative symptoms|catatonia)\b/],
    ["Mood Disorders", /\b(depress|mania|manic|bipolar|cyclothym|dysthym|lithium|valproate|ketamine|ect)\b/],
    ["Anxiety, OCD and Trauma", /\b(anxiety|panic|phobia|agoraphobia|ocd|obsess|compuls|ptsd|trauma|emdr)\b/],
    ["Substance Use and Addictions", /\b(alcohol|opioid|cannabis|cocaine|amphetamine|withdrawal|dependence|wernicke|benzodiazepine)\b/],
    ["Neurocognitive and Organic Psychiatry", /\b(delirium|dementia|alzheimer|lewy|parkinson|huntington|organic|neurocognitive|encephalitis)\b/],
    ["Child, Adolescent and Neurodevelopmental", /\b(autism|adhd|intellectual disability|child|adolescent|tics|tourette|enuresis)\b/],
    ["Personality Disorders", /\b(personality|borderline|antisocial|narcissistic|avoidant|cluster)\b/],
    ["Eating and Somatic Disorders", /\b(anorexia|bulimia|binge|eating disorder|somatic|body dysmorphic|conversion)\b/],
    ["Psychopharmacology and Biological Treatment", /\b(ssri|snri|maoi|antipsychotic|antidepressant|benzodiazepine|stabilizer|tardive|akathisia|serotonin syndrome|nms|prolactin|hyponatremia)\b/],
    ["Legal, Ethics and Capacity", /\b(capacity|consent|confidential|involuntary|forensic|legal|court|duty|competence)\b/],
    ["Emergency and Risk", /\b(suicide|homicide|violence|emergency|agitation|restraint|rapid tranquil|self-harm|overdose)\b/],
  ];

  return topicRules.find(([, pattern]) => pattern.test(text))?.[0] || "General Psychiatry";
}

function getQuestionWeakAreaTags(question) {
  const explicitSingle = firstQuestionField(question, ["weakArea", "weak_area", "weakTag", "weak_tag", "weaknessTag", "weakness_tag"]);
  const explicitArray = Array.isArray(question?.weakAreas)
    ? question.weakAreas
    : Array.isArray(question?.weak_areas)
      ? question.weak_areas
      : Array.isArray(question?.weakTags)
        ? question.weakTags
        : Array.isArray(question?.tags)
          ? question.tags.filter(tag => WRITTEN_WEAK_AREA_LABELS.includes(normalizeQuestionText(tag)))
          : [];
  const explicitTags = [
    ...(explicitSingle ? [explicitSingle] : []),
    ...explicitArray,
  ].map(tag => String(tag).trim()).filter(Boolean);

  if (explicitTags.length) return [...new Set(explicitTags)];

  const text = getQuestionSearchText(question);
  const tags = [];
  const addIf = (label, pattern) => {
    if (pattern.test(text)) tags.push(label);
  };

  addIf("diagnostic exclusion", /\b(exclude|rule out|not diagnose|before diagnosing|medical cause|substance-induced|duration|criterion|criteria)\b/);
  addIf("risk assessment", /\b(suicide|homicide|self-harm|violence|risk|protective factor|danger)\b/);
  addIf("emergency psychiatry", /\b(emergency|acute agitation|rapid tranquil|restraint|seclusion|overdose|nms|serotonin syndrome|catatonia|delirium tremens)\b/);
  addIf("psychopharmacology sequencing", /\b(first-line|next step|after failure|treatment-resistant|augment|switch|sequence|clozapine|lithium|ect)\b/);
  addIf("capacity / legal issues", /\b(capacity|consent|confidential|involuntary|forensic|legal|competence|court|duty)\b/);
  addIf("differential diagnosis", /\b(differential|distinguish|distinguished|versus|mimic|most likely diagnosis|diagnosis)\b/);
  addIf("organic and substance-induced disorders", /\b(organic|substance-induced|delirium|dementia|intoxication|withdrawal|medical cause|neurological|endocrine)\b/);
  addIf("management decisiveness", /\b(management|next step|best treatment|admit|hospital|urgent|immediate|start|refer)\b/);
  addIf("adverse effects and monitoring", /\b(adverse|side effect|monitor|monitoring|toxicity|levels|agranulocytosis|metabolic|qtc|prolactin|hyponatremia|tardive)\b/);
  addIf("over-nuance traps", /\b(except|least likely|most appropriate|best answer|always|never|subtle|trap)\b/);

  return [...new Set(tags)];
}

function getPrimaryWeakArea(question) {
  return getQuestionWeakAreaTags(question)[0] || "No weak-area tag";
}

function getQuestionExamLesson(question) {
  return firstQuestionField(question, ["examLesson", "exam_lesson", "examTip", "exam_tip", "lesson"]);
}

function getQuestionSignature(question) {
  const tokens = normalizeQuestionText(question?.stem)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 3 && !["which", "what", "with", "from", "that", "this", "most", "best", "following", "patient", "correct"].includes(token));

  return tokens.slice(0, 18).join(" ") || `question-${question?.id}`;
}

function selectWrittenExamQuestions(progress, count = WRITTEN_EXAM_SIZE) {
  const eligible = QUESTIONS.filter(question =>
    Array.isArray(question.options) &&
    question.options.length === 5 &&
    Number.isInteger(question.correct) &&
    question.correct >= 0 &&
    question.correct < question.options.length
  );
  const targetCount = Math.min(count, eligible.length);
  const weakTarget = Math.max(0, Math.round(targetCount * 0.25));
  const selected = [];
  const usedIds = new Set();
  const usedSignatures = new Set();

  const pushQuestion = (question) => {
    if (!question || usedIds.has(question.id)) return false;
    const signature = getQuestionSignature(question);
    if (usedSignatures.has(signature)) return false;
    usedIds.add(question.id);
    usedSignatures.add(signature);
    selected.push(question);
    return true;
  };

  const weakCandidates = eligible
    .map(question => ({ question, score: scoreQuestionForWeakness(question, progress) }))
    .filter(item => isWeaknessCandidate(item.question, progress) && item.score >= 25)
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);

  for (const question of weakCandidates) {
    if (selected.length >= weakTarget) break;
    pushQuestion(question);
  }

  const byTopic = new Map();
  shuffleItems(eligible).forEach(question => {
      const topic = getQuestionTopic(question);
      byTopic.set(topic, [...(byTopic.get(topic) || []), question]);
    });

  while (selected.length < targetCount) {
    let addedInRound = false;
    for (const [, topicQuestions] of byTopic) {
      while (topicQuestions.length) {
        const candidate = topicQuestions.shift();
        if (pushQuestion(candidate)) {
          addedInRound = true;
          break;
        }
      }
      if (selected.length >= targetCount) break;
    }
    if (!addedInRound) break;
  }

  for (const question of shuffleItems(eligible)) {
    if (selected.length >= targetCount) break;
    pushQuestion(question);
  }

  return shuffleItems(selected);
}

function getDailyChallenge(progress, dateKey = getLocalDateKey()) {
  return progress.dailyChallenges?.[dateKey] || null;
}

function createDailyChallenge(progress, dateKey = getLocalDateKey()) {
  const existing = getDailyChallenge(progress, dateKey);
  if (existing?.questionIds?.length) return existing;

  const now = new Date();
  const usedIds = new Set();
  const wrongTarget = Math.min(DAILY_CHALLENGE_SIZE, Math.round(DAILY_CHALLENGE_SIZE * 0.8));
  const repeatedWrong = selectDailyWrongQuestions(progress, wrongTarget, usedIds, now);
  const reviewTarget = DAILY_CHALLENGE_SIZE - repeatedWrong.length;
  const reviewQuestions = selectDailyReviewQuestions(progress, reviewTarget, usedIds, now);
  const remaining = DAILY_CHALLENGE_SIZE - repeatedWrong.length - reviewQuestions.length;
  const fallback = remaining > 0
    ? selectUniqueQuestions(
        shuffleItems(QUESTIONS).map(question => ({ question, reason: "fallback_random" })),
        remaining,
        usedIds
      )
    : [];
  const items = [...repeatedWrong, ...reviewQuestions, ...fallback].slice(0, DAILY_CHALLENGE_SIZE).map((item, index) => ({
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
  if (mode === "written") return selectWrittenExamQuestions(progress, WRITTEN_EXAM_SIZE);
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

function recordWrittenExamSubmission(progress, questions, answers, sessionId) {
  return questions.reduce((nextProgress, question) => {
    const selected = answers[question.id];
    if (selected === undefined || selected === null) {
      return markQuestionSeen(nextProgress, question.id);
    }

    return recordQuestionAnswer(nextProgress, question, selected, {
      mode: "written",
      confidence: 3,
      timeTakenMs: null,
      pointsAwarded: selected === question.correct ? 100 : 0,
      pointBreakdown: null,
      sessionId,
      streakPosition: 0,
    });
  }, progress);
}

function getWrittenPerformanceCategory(scorePercent) {
  if (scorePercent >= 90) return { label: "Exam-ready", className: "excellent" };
  if (scorePercent > 70) return { label: "Good performance", className: "good" };
  if (scorePercent >= 50) return { label: "Barely passing / borderline", className: "pass" };
  return { label: "Not yet passing level", className: "fail" };
}

function buildBreakdown(items, getLabel) {
  const map = new Map();

  items.forEach(item => {
    const labels = getLabel(item.question);
    const normalizedLabels = Array.isArray(labels) && labels.length ? labels : [labels || "No weak-area tag"];

    normalizedLabels.forEach(label => {
      const current = map.get(label) || { label, total: 0, correct: 0, wrong: 0, unanswered: 0 };
      current.total += 1;
      if (item.selected === undefined || item.selected === null) current.unanswered += 1;
      else if (item.isCorrect) current.correct += 1;
      else current.wrong += 1;
      map.set(label, current);
    });
  });

  return [...map.values()]
    .map(row => ({
      ...row,
      percent: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function getWrittenExamResult(questions, answers) {
  const items = questions.map(question => {
    const selected = answers[question.id];
    return {
      question,
      selected,
      isCorrect: selected !== undefined && selected !== null && selected === question.correct,
      isUnanswered: selected === undefined || selected === null,
    };
  });
  const correct = items.filter(item => item.isCorrect).length;
  const unanswered = items.filter(item => item.isUnanswered).length;
  const wrong = items.length - correct - unanswered;
  const scorePercent = items.length > 0 ? Math.round((correct / items.length) * 100) : 0;

  return {
    total: items.length,
    correct,
    wrong,
    unanswered,
    scorePercent,
    performance: getWrittenPerformanceCategory(scorePercent),
    topicBreakdown: buildBreakdown(items, question => getQuestionTopic(question)),
    weakAreaBreakdown: buildBreakdown(items, question => getQuestionWeakAreaTags(question)),
    wrongItems: items.filter(item => !item.isUnanswered && !item.isCorrect),
  };
}
// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

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

  /* ─── HOME SCREEN ─── */
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

  .home-sharing-note {
    margin: 26px auto 0;
    max-width: 520px;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.5;
  }

  .home-sharing-note small {
    display: block;
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 11px;
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

  /* ─── MCQ SELECTION ─── */
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

  /* ─── MCQ TEST ─── */
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
    flex-wrap: wrap;
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

  .mcq-feedback {
    position: relative;
    margin-left: auto;
    font-family: 'DM Sans', sans-serif;
  }

  .mcq-feedback-btn {
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-dim);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s;
  }

  .mcq-feedback-btn:hover {
    background: var(--bg-card-hover);
    color: var(--text);
  }

  .mcq-feedback-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .mcq-feedback-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 140;
    min-width: 250px;
    overflow: hidden;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
  }

  .mcq-feedback-option {
    display: block;
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    padding: 10px 12px;
    font-family: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .mcq-feedback-option:last-child {
    border-bottom: 0;
  }

  .mcq-feedback-option:hover {
    background: var(--bg-card-hover);
  }

  .mcq-feedback-message {
    display: inline-flex;
    margin: -4px 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 700;
  }

  .mcq-feedback-message.success {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
  }

  .mcq-feedback-message.error {
    background: var(--red-bg);
    border-color: rgba(239,68,68,0.35);
    color: var(--red);
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

  /* ─── NAVIGATION BAR ─── */
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

  /* ─── RESULTS ─── */
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

  /* ─── MODAL ─── */
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

  /* ─── PLACEHOLDER ─── */
  .written-results {
    max-width: 960px;
    text-align: left;
  }

  .written-results .results-score,
  .written-results .results-label,
  .written-results .results-detail {
    text-align: center;
  }

  .written-result-grid,
  .written-breakdown-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 18px 0;
  }

  .written-breakdown-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .written-result-stat,
  .written-breakdown,
  .wrong-answer-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 16px;
  }

  .written-result-stat {
    text-align: center;
  }

  .written-result-stat strong {
    display: block;
    color: var(--text);
    font-size: 26px;
    font-variant-numeric: tabular-nums;
  }

  .written-result-stat span,
  .wrong-answer-topline,
  .written-breakdown h3 {
    color: var(--text-dim);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .written-breakdown h3 {
    margin-bottom: 12px;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    border-top: 1px solid var(--border);
    padding: 10px 0;
    color: var(--text-dim);
    font-size: 13px;
  }

  .breakdown-row strong {
    color: var(--text);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .written-review {
    max-width: 900px;
  }

  .written-review h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 30px;
    font-weight: 400;
    margin-bottom: 18px;
  }

  .wrong-answer-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 80px;
  }

  .wrong-answer-topline,
  .written-meta-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .wrong-question-stem {
    color: var(--text);
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 14px;
  }

  .written-answer-row {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    margin-bottom: 8px;
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.5;
  }

  .written-answer-row strong {
    display: block;
    color: var(--text);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .written-answer-row.correct {
    border-color: rgba(34,197,94,0.35);
    background: var(--green-bg);
  }

  .written-answer-row.incorrect {
    border-color: rgba(239,68,68,0.35);
    background: var(--red-bg);
  }

  .meta-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 12px;
    padding: 4px 8px;
  }

  .exam-lesson {
    border-left-color: var(--gold);
  }

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

  /* ─── REVIEW MODE ─── */
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

  /* ── Oral Accordion ─────────────────────────────── */

  .oral-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  .oral-choice,
  .oral-simulator {
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 20px;
  }

  .oral-choice h2,
  .oral-simulator h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 32px;
    font-weight: 400;
    margin-bottom: 8px;
    text-align: center;
  }

  .oral-choice p,
  .oral-simulator p {
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.6;
    margin: 0 auto 28px;
    max-width: 560px;
    text-align: center;
  }

  .oral-simulator {
    padding-bottom: 92px;
  }

  .oral-exam-meta,
  .oral-exam-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--text-dim);
    font-size: 12px;
    margin-bottom: 10px;
  }

  .oral-exam-meta span {
    border: 1px solid var(--border);
    background: var(--bg-card);
    border-radius: 999px;
    padding: 4px 9px;
  }

  .oral-exam-context {
    justify-content: flex-start;
    margin-bottom: 18px;
  }

  .oral-notes-label {
    display: block;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }

  .oral-answer-notes {
    width: 100%;
    min-height: 96px;
    resize: vertical;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 12px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 18px;
  }

  .oral-answer-notes:focus {
    outline: none;
    border-color: var(--border-active);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.16);
  }

  .oral-exam-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 24px 0;
  }

  .oral-exam-summary-row {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
  }

  .oral-exam-summary-row small {
    display: block;
    color: var(--text-dim);
    margin-top: 4px;
  }

  .oral-overview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: -14px auto 24px;
    color: var(--text-dim);
    font-size: 13px;
  }
  .oral-overview strong {
    color: var(--text);
    font-size: 15px;
  }

  .oral-progress-pill {
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 2px 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .oral-progress-pill.complete {
    color: var(--green);
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
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

  /* ── Oral Question Viewer ─────────────────────────── */

  .oral-viewer {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  .oral-q-counter {
    font-size: 13px;
    color: var(--text-dim);
  }

  .oral-viewer-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .oral-q-text {
    font-size: 17px;
    line-height: 1.7;
    color: var(--text);
    margin-bottom: 28px;
    font-weight: 500;
  }

  .oral-mastery-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: -12px 0 24px;
    padding: 9px 13px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-dim);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s;
  }
  .oral-mastery-toggle:hover {
    background: var(--bg-card-hover);
    color: var(--text);
  }
  .oral-mastery-toggle.mastered {
    color: var(--green);
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.35);
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

  /* ── Oral Reference Table ─────────────────────────── */

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

  /* SOS */

  .sos-screen {
    max-width: 760px;
    margin: 0 auto;
    padding: 20px;
  }

  .sos-screen h2 {
    font-size: 24px;
    margin-bottom: 22px;
  }

  .sos-option-grid {
    display: grid;
    gap: 12px;
  }

  .sos-option-card,
  .sos-list-entry,
  .sos-accordion-entry {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    color: var(--text);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sos-option-card {
    min-height: 92px;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 18px;
    font-weight: 700;
  }

  .sos-option-card:hover,
  .sos-list-entry:hover,
  .sos-accordion-entry:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
  }

  .sos-list {
    display: grid;
    gap: 8px;
  }

  .sos-list-entry {
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
    font-weight: 600;
  }

  .sos-list-entry.mastered {
    border-color: rgba(34,197,94,0.35);
    background: var(--green-bg);
  }

  .sos-list-entry.mastered svg {
    color: var(--green);
    flex-shrink: 0;
  }

  .sos-accordion-entry {
    padding: 0;
    overflow: hidden;
  }

  .sos-entry-title {
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
    font-weight: 600;
  }

  .sos-accordion-entry.open .sos-entry-title svg {
    transform: rotate(180deg);
  }

  .sos-answer-box {
    margin: 0 16px 16px;
    padding: 16px;
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
  }

  .sos-detail-answer {
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-surface);
    color: var(--text);
    font-size: 15px;
    line-height: 1.75;
    white-space: pre-wrap;
  }

  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .home-title { font-size: 32px; }
    .profile-form { flex-direction: column; }
    .mcq-memory { grid-template-columns: 1fr; }
    .game-hud { grid-template-columns: repeat(2, 1fr); }
    .written-result-grid,
    .written-breakdown-grid { grid-template-columns: 1fr; }
    .breakdown-row { flex-direction: column; gap: 4px; }
    .breakdown-row strong { white-space: normal; }
    .nav-bar { gap: 6px; padding: 12px 16px; }
    .nav-btn { padding: 8px 12px; font-size: 13px; }
    .sprint-auto-toggle { right: 12px; bottom: 68px; }
  }
`;

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

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
              const oralSummary = summarizeOralProgress(profile.oralProgress || createEmptyOralProgress());
              return (
                <button
                  key={profile.id}
                  className="profile-btn"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <span>{profile.name}</span>
                  <small>MCQ {summary.mastered} mastered · Oral {oralSummary.mastered}/{oralSummary.total}</small>
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
    { id: 'oral', icon: <Icons.Mic />, iconClass: 'purple', title: 'Προφορικά', desc: 'Προηγούμενα θέματα και προσομοίωση προφορικής εξέτασης', active: true },
    { id: 'sos', icon: <Icons.BookOpen />, iconClass: 'rose', title: 'SOS Ψυχιατρικής', desc: 'Αριθμοί, κρίσιμα θέματα και διαφοροδιάγνωση', active: true },
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
      <div className="home-sharing-note">
        <div>Χρησιμοποιήστε την εφαρμογή ελεύθερα, μοιραστείτε την υπεύθηνα</div>
        <small>Μακριά από εξεταστές</small>
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
      <button className="mode-btn" onClick={() => onStart('written')}>
        Written Exam Simulation
        <small>100-question exam simulation with no timer, no feedback during the exam, and full results after submission.</small>
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
  const [writtenResult, setWrittenResult] = useState(null);
  const [reviewWrittenWrong, setReviewWrittenWrong] = useState(false);
  const [showWrittenSubmitWarning, setShowWrittenSubmitWarning] = useState(false);
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [feedbackSavingType, setFeedbackSavingType] = useState(null);
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
  const writtenAnsweredCount = mode === "written"
    ? questions.filter(question => answers[question.id] !== undefined && answers[question.id] !== null).length
    : 0;
  const writtenUnansweredCount = mode === "written" ? totalQ - writtenAnsweredCount : 0;
  const modeTitle = {
    daily: "Daily",
    random: "Random",
    sprint: "Sprint",
    weakness: "Weakness",
    written: "Written Exam Simulation",
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
    setFeedbackMenuOpen(false);
    setFeedbackStatus(null);
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
    if (mode === "written") return;
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
    if (isLocked || writtenResult) return;
    setAnswers(prev => ({ ...prev, [q.id]: idx }));
  };

  const submitMcqFeedback = async (feedbackType) => {
    if (!q || feedbackSavingType) return;

    setFeedbackSavingType(feedbackType);
    setFeedbackStatus(null);
    try {
      await saveMcqFeedback(q.id, feedbackType, {
        questionTextSnapshot: q.stem,
        topic: getQuestionTopic(q),
        subtopic: getPrimaryWeakArea(q),
      });
      setFeedbackMenuOpen(false);
      setFeedbackStatus({ type: "success", message: "Feedback saved." });
    } catch {
      setFeedbackStatus({ type: "error", message: "Could not save feedback." });
    } finally {
      setFeedbackSavingType(null);
    }
  };

  const submitWrittenExam = useCallback((forceSubmit = false) => {
    if (mode !== "written" || writtenResult) return;
    const result = getWrittenExamResult(questions, answers);
    if (!forceSubmit && result.unanswered > 0) {
      setShowWrittenSubmitWarning(true);
      return;
    }

    setShowWrittenSubmitWarning(false);
    setWrittenResult(result);
    onProgressChange(prev => recordWrittenExamSubmission(prev, questions, answers, sessionIdRef.current));
  }, [answers, mode, onProgressChange, questions, writtenResult]);

  const restartWrittenExam = () => {
    sessionIdRef.current = `${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionFinishedRef.current = false;
    advancingRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(getSessionQuestions(mode, progress));
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setWrittenResult(null);
    setReviewWrittenWrong(false);
    setShowWrittenSubmitWarning(false);
    setSessionStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      currentStreak: 0,
      maxStreak: 0,
      points: 0,
    });
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

  if (mode === "written" && writtenResult && reviewWrittenWrong) {
    return (
      <div className="test-container written-review fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={() => setReviewWrittenWrong(false)}>
            <Icons.ChevronLeft /> Results
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Wrong Answer Review</h2>
        {writtenResult.wrongItems.length === 0 ? (
          <div className="explanation-box">
            <strong>No wrong answers</strong>
            This written simulation had no answered questions marked incorrect.
          </div>
        ) : (
          <div className="wrong-answer-list">
            {writtenResult.wrongItems.map((item, index) => {
              const question = item.question;
              const examLesson = getQuestionExamLesson(question);
              const weakTags = getQuestionWeakAreaTags(question);
              return (
                <div className="wrong-answer-card" key={question.id}>
                  <div className="wrong-answer-topline">
                    <span>Question {index + 1}</span>
                    <span>Bank ID {question.id}</span>
                  </div>
                  <div className="wrong-question-stem">{question.stem}</div>
                  <div className="written-answer-row incorrect">
                    <strong>Your answer</strong>
                    <span>{OPTION_LETTERS[item.selected]}. {question.options[item.selected]}</span>
                  </div>
                  <div className="written-answer-row correct">
                    <strong>Correct answer</strong>
                    <span>{OPTION_LETTERS[question.correct]}. {question.options[question.correct]}</span>
                  </div>
                  <div className="written-meta-row">
                    <span className="meta-pill">{getQuestionTopic(question)}</span>
                    {(weakTags.length ? weakTags : ["No weak-area tag"]).map(tag => (
                      <span className="meta-pill" key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="explanation-box">
                    <strong>Explanation</strong>
                    {question.explanation}
                  </div>
                  {examLesson && (
                    <div className="explanation-box exam-lesson">
                      <strong>Exam lesson</strong>
                      {examLesson}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (mode === "written" && writtenResult) {
    return (
      <div className="results written-results fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>

        <div className={`results-score ${writtenResult.performance.className}`}>
          {writtenResult.scorePercent}%
        </div>
        <div className="results-label">{writtenResult.performance.label}</div>
        <div className="results-detail">
          {writtenResult.correct}/{writtenResult.total} correct, {writtenResult.wrong} wrong
          {writtenResult.unanswered > 0 ? `, ${writtenResult.unanswered} unanswered` : ""}
        </div>

        <div className="written-result-grid">
          <div className="written-result-stat">
            <strong>{writtenResult.correct}</strong>
            <span>Correct</span>
          </div>
          <div className="written-result-stat">
            <strong>{writtenResult.wrong}</strong>
            <span>Wrong</span>
          </div>
          <div className="written-result-stat">
            <strong>{writtenResult.unanswered}</strong>
            <span>Unanswered</span>
          </div>
        </div>

        <div className="written-breakdown-grid">
          <div className="written-breakdown">
            <h3>Topic Breakdown</h3>
            {writtenResult.topicBreakdown.map(row => (
              <div className="breakdown-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.correct}/{row.total} ({row.percent}%)</strong>
              </div>
            ))}
          </div>
          <div className="written-breakdown">
            <h3>Weak-Area Breakdown</h3>
            {writtenResult.weakAreaBreakdown.map(row => (
              <div className="breakdown-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.correct}/{row.total} ({row.percent}%)</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="written-breakdown">
          <h3>Wrong Answers</h3>
          {writtenResult.wrongItems.length === 0 ? (
            <div className="breakdown-row">
              <span>No wrong answers</span>
              <strong>-</strong>
            </div>
          ) : (
            writtenResult.wrongItems.slice(0, 12).map(item => (
              <div className="breakdown-row" key={item.question.id}>
                <span>Question {item.question.id}: {getQuestionTopic(item.question)}</span>
                <strong>{OPTION_LETTERS[item.selected]} to {OPTION_LETTERS[item.question.correct]}</strong>
              </div>
            ))
          )}
          {writtenResult.wrongItems.length > 12 && (
            <div className="breakdown-row">
              <span>Additional wrong answers</span>
              <strong>{writtenResult.wrongItems.length - 12}</strong>
            </div>
          )}
        </div>

        <div className="results-actions">
          <button className="results-btn primary" onClick={() => setReviewWrittenWrong(true)} disabled={writtenResult.wrongItems.length === 0}>
            Review all wrong answers
          </button>
          <button className="results-btn" onClick={restartWrittenExam}>
            Restart simulation
          </button>
          <button className="results-btn" onClick={onBack}>
            MCQ section
          </button>
        </div>
      </div>
    );
  }

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

      {mode === "written" ? (
        <div className="game-hud">
          <div className="hud-stat">
            <span className="hud-value">{currentIdx + 1}</span>
            <span className="hud-label">Current</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{writtenAnsweredCount}</span>
            <span className="hud-label">Answered</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{writtenUnansweredCount}</span>
            <span className="hud-label">Unanswered</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{totalQ}</span>
            <span className="hud-label">Total</span>
          </div>
        </div>
      ) : (
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
      )}

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
          {mode === "written" ? `Answered ${writtenAnsweredCount}/${totalQ}` : `Mastered ${progressStats.mastered}/${progressStats.total}`}
        </span>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: mode === "written"
                ? `${totalQ > 0 ? (writtenAnsweredCount / totalQ) * 100 : 0}%`
                : `${(progressStats.mastered / progressStats.total) * 100}%`,
            }}
          />
        </div>
        <span className="progress-text">
          {modeTitle} {currentIdx + 1}/{totalQ}
        </span>
      </div>

      <div className="question-num">
        Question {q.id}
        {mode !== "written" && <span className={`question-status ${questionStatus.toLowerCase()}`}>{questionStatus}</span>}
        {mode !== "written" && dailyReason && <span className="question-status seen">{getDailyReasonLabel(dailyReason)}</span>}
        <div className="mcq-feedback">
          <button
            className="mcq-feedback-btn"
            onClick={() => {
              setFeedbackMenuOpen(open => !open);
              setFeedbackStatus(null);
            }}
            disabled={Boolean(feedbackSavingType)}
          >
            Feedback
          </button>
          {feedbackMenuOpen && (
            <div className="mcq-feedback-menu">
              {MCQ_FEEDBACK_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className="mcq-feedback-option"
                  onClick={() => submitMcqFeedback(option.value)}
                  disabled={Boolean(feedbackSavingType)}
                >
                  {feedbackSavingType === option.value ? "Saving..." : option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {feedbackStatus && (
        <div className={`mcq-feedback-message ${feedbackStatus.type}`}>
          {feedbackStatus.message}
        </div>
      )}
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

      {isLocked && mode !== "written" && (
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

      {mode === "written" ? (
        <div className="nav-bar">
          <button className="nav-btn" onClick={() => setCurrentIdx(prevIdx)} disabled={prevIdx < 0}>
            <Icons.ChevronLeft />
          </button>
          <button className="nav-btn" onClick={() => setCurrentIdx(nextIdx)} disabled={nextIdx < 0 || nextIdx >= totalQ}>
            <Icons.ChevronRight />
          </button>
          <button className="nav-btn primary" onClick={() => submitWrittenExam(false)}>
            Submit exam
          </button>
        </div>
      ) : (
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
      )}

      {showWrittenSubmitWarning && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Unanswered questions warning">
          <div className="modal">
            <h3>Submit with unanswered questions?</h3>
            <p>
              {writtenUnansweredCount} question{writtenUnansweredCount === 1 ? "" : "s"} are unanswered.
              Unanswered questions count as not correct in the final score.
            </p>
            <div className="modal-actions">
              <button className="results-btn primary" onClick={() => submitWrittenExam(true)}>
                Submit anyway
              </button>
              <button className="results-btn" onClick={() => setShowWrittenSubmitWarning(false)}>
                Continue exam
              </button>
            </div>
          </div>
        </div>
      )}

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
// ═══════════════════════════════════════════════════════════════

function OralChoiceScreen({ onBack, onHome, onOpenPastTopics, onOpenSimulator }) {
  return (
    <div className="oral-choice fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:32}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <h2>Προφορικά</h2>
      <p>Επιλέξτε τρόπο εξάσκησης για το προφορικό μέρος της εξέτασης.</p>

      <button className="mode-btn" onClick={onOpenPastTopics}>
        Προηγούμενα Θέματα
        <small>Εξάσκηση με τα υπάρχοντα προφορικά θέματα και ερωτήσεις της τράπεζας.</small>
      </button>
      <button className="mode-btn featured" onClick={onOpenSimulator}>
        Προφορική Εξέταση
        <small>Προσομοίωση προφορικής εξέτασης με βασικές και follow-up ερωτήσεις.</small>
      </button>
    </div>
  );
}

function OralAccordion({ onBack, onHome, onNavigateToViewer, onNavigateToTable, oralProgress }) {
  const [expandedGravity, setExpandedGravity] = useState({});
  const [expandedTopic, setExpandedTopic] = useState({});
  const normalizedOralProgress = normalizeOralProgress(oralProgress);
  const overallSummary = summarizeOralProgress(normalizedOralProgress);

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

  const renderProgressPill = (questions) => {
    const summary = summarizeOralProgress(normalizedOralProgress, questions);
    return (
      <span className={`oral-progress-pill ${summary.total > 0 && summary.mastered === summary.total ? "complete" : ""}`}>
        {summary.mastered}/{summary.total}
      </span>
    );
  };

  return (
    <div className="oral-container fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <h2 style={{textAlign:'center', marginBottom:6, fontSize:22}}>Προηγούμενα Θέματα</h2>
      <p style={{textAlign:'center', color:'var(--text-dim)', fontSize:13, marginBottom:28}}>Ερωτήσεις κατά βαρύτητα θέματος</p>
      <div className="oral-overview">
        <strong>{overallSummary.mastered}/{overallSummary.total}</strong>
        <span>κατακτημένες ερωτήσεις</span>
      </div>

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
            {!gravity.isTable && renderProgressPill(getOralQuestionsFromGravity(gravity))}
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
                    {renderProgressPill(getOralQuestionsFromTopic(topic))}
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
                          {renderProgressPill(sub.questions)}
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

function OralQuestionViewer({ questions, title, oralProgress, onQuestionMastered, onBack, onHome }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const q = questions[currentIdx];
  const total = questions.length;
  const normalizedOralProgress = normalizeOralProgress(oralProgress);
  const sectionSummary = summarizeOralProgress(normalizedOralProgress, questions);
  const isMastered = Boolean(normalizedOralProgress.mastered[q.id]);

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
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>

      <p style={{fontSize:13, color:'var(--text-dim)', marginBottom:4}}>{title}</p>
      <div className="oral-viewer-meta">
        <div className="oral-q-counter">Ερώτηση {currentIdx + 1} / {total}</div>
        <span className={`oral-progress-pill ${sectionSummary.total > 0 && sectionSummary.mastered === sectionSummary.total ? "complete" : ""}`}>
          {sectionSummary.mastered}/{sectionSummary.total} mastered
        </span>
      </div>

      <div className="oral-q-text">{q.text}</div>
      <button
        className={`oral-mastery-toggle ${isMastered ? "mastered" : ""}`}
        onClick={() => onQuestionMastered(q.id, !isMastered)}
      >
        <Icons.Check />
        {isMastered ? "Mastered" : "Mark as mastered"}
      </button>

      {q.source && <div className="oral-source">{q.source}</div>}

      <div
        className={`answer-box ${showAnswer ? 'revealed' : ''}`}
        onClick={() => setShowAnswer(!showAnswer)}
      >
        {!showAnswer ? (
          <div className="answer-placeholder">
            <Icons.Eye />
            <div style={{marginTop:8}}>Πατήστε για να δείτε την απάντηση</div>
          </div>
        ) : (
          <div className="answer-content">{q.answer}</div>
        )}
      </div>

      <div style={{ height: 80 }} />

      <div className="nav-bar">
        <button className="nav-btn" onClick={goPrev} disabled={currentIdx === 0}>
          <Icons.ChevronLeft /> Προηγούμενη
        </button>
        <button className="nav-btn" onClick={goNext} disabled={currentIdx === total - 1}>
          Επόμενη <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}

function OralExamSimulator({ onBack, onHome }) {
  const [phase, setPhase] = useState("start");
  const [session, setSession] = useState([]);
  const [examinerIndex, setExaminerIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const currentExaminer = session[examinerIndex];
  const currentQuestions = currentExaminer
    ? [currentExaminer.anchor, ...currentExaminer.followUps]
    : [];
  const currentQuestion = currentQuestions[questionIndex];
  const askedQuestions = session.flatMap(item => [item.anchor, ...item.followUps]);
  const isAnchorQuestion = currentQuestion?.id === currentExaminer?.anchor?.id;
  const isLastQuestionForExaminer = questionIndex >= currentQuestions.length - 1;
  const isLastExaminer = examinerIndex >= session.length - 1;

  const startExam = () => {
    const nextSession = createOralExamSession();
    setSession(nextSession);
    setExaminerIndex(0);
    setQuestionIndex(0);
    setShowAnswer(false);
    setPhase("session");
  };

  const advanceQuestion = () => {
    setShowAnswer(false);
    if (!isLastQuestionForExaminer) {
      setQuestionIndex(index => index + 1);
      return;
    }

    if (!isLastExaminer) {
      setExaminerIndex(index => index + 1);
      setQuestionIndex(0);
      return;
    }

    setPhase("result");
  };

  if (phase === "result") {
    return (
      <div className="oral-simulator fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Αρχική
          </button>
        </div>
        <h2>Ολοκλήρωση Προφορικής Εξέτασης</h2>
        <div className="oral-exam-summary">
          {askedQuestions.map((question, index) => (
            <div className="oral-exam-summary-row" key={`${question.id}-${index}`}>
              <span>{index + 1}. {getOralExamQuestionText(question)}</span>
            </div>
          ))}
        </div>
        <div className="results-actions">
          <button className="results-btn primary" onClick={startExam}>
            Νέα Προφορική Εξέταση
          </button>
          <button className="results-btn" onClick={onBack}>
            Επιστροφή στα Προφορικά
          </button>
        </div>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div className="oral-simulator fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Αρχική
          </button>
        </div>
        <h2>Προφορική Εξέταση</h2>
        <p>
          Η εξέταση ξεκινά με βασικές ερωτήσεις και μπορεί να συνεχίσει με follow-up ερωτήσεις,
          όπως σε πραγματική προφορική εξέταση.
        </p>
        <button className="results-btn primary" onClick={startExam}>
          Έναρξη Εξέτασης
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="oral-simulator fade-in">
        <div className="explanation-box">
          <strong>Δεν υπάρχουν διαθέσιμες ερωτήσεις</strong>
          Η προσομοίωση χρησιμοποιεί την υπάρχουσα τράπεζα προφορικών ερωτήσεων.
        </div>
        <button className="results-btn" onClick={onBack}>
          Επιστροφή στα Προφορικά
        </button>
      </div>
    );
  }

  const nextButtonLabel = !isLastQuestionForExaminer
    ? "Επόμενη Ερώτηση"
    : !isLastExaminer
      ? "Επόμενος Εξεταστής"
      : "Τέλος Εξέτασης";

  return (
    <div className="oral-simulator fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>

      <div className="oral-exam-meta">
        <span>Εξεταστής {examinerIndex + 1} / {session.length}</span>
        <span>{isAnchorQuestion ? "Βασική ερώτηση" : "Follow-up ερώτηση"}</span>
      </div>
      <div className="oral-exam-context">
        {getOralExamQuestionContext(currentQuestion)}
      </div>

      <div className="oral-q-text">{getOralExamQuestionText(currentQuestion)}</div>

      <div
        className={`answer-box ${showAnswer ? 'revealed' : ''}`}
        onClick={() => setShowAnswer(!showAnswer)}
      >
        {!showAnswer ? (
          <div className="answer-placeholder">
            <Icons.Eye />
            <div style={{marginTop:8}}>Πατήστε για να δείτε την ενδεικτική απάντηση</div>
          </div>
        ) : (
          <div className="answer-content">{getOralExamQuestionAnswer(currentQuestion)}</div>
        )}
      </div>

      <div style={{ height: 80 }} />

      <div className="nav-bar">
        <button className="nav-btn primary" onClick={advanceQuestion}>
          {nextButtonLabel} <Icons.ChevronRight />
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
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <h2 style={{textAlign:'center', marginBottom:6, fontSize:20}}>Γρήγορες Απαντήσεις</h2>
      <p style={{textAlign:'center', color:'var(--text-dim)', fontSize:13, marginBottom:24}}>Αριθμοί που πρέπει να ξέρεις</p>

      {rows.map((row, i) => (
        <div key={i} className="ref-row">
          <span className="ref-topic">{row.topic}</span>
          <span className="ref-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function SosHome({ onBack, onHome, onOpenSection }) {
  const sections = [
    { id: "numbers", title: "Αριθμοί που πρέπει να θυμάμαι" },
    { id: "critical", title: "Κρίσιμα Θέματα" },
    { id: "differential", title: "Διαφοροδιάγνωση" },
  ];

  return (
    <div className="sos-screen fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <h2>SOS Ψυχιατρικής</h2>
      <div className="sos-option-grid">
        {sections.map(section => (
          <button
            key={section.id}
            className="sos-option-card"
            onClick={() => onOpenSection(section.id)}
          >
            {section.title}
            <Icons.ChevronRight />
          </button>
        ))}
      </div>
    </div>
  );
}

function SosNumbersList({ onBack, onHome }) {
  const [openEntryId, setOpenEntryId] = useState(null);

  return (
    <div className="sos-screen fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> SOS Ψυχιατρικής
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <h2>Αριθμοί που πρέπει να θυμάμαι</h2>
      <div className="sos-list">
        {sosNumbers.map(entry => {
          const isOpen = openEntryId === entry.id;
          return (
            <button
              key={entry.id}
              className={`sos-accordion-entry ${isOpen ? "open" : ""}`}
              onClick={() => setOpenEntryId(isOpen ? null : entry.id)}
            >
              <div className="sos-entry-title">
                <span>{entry.title}</span>
                <Icons.ChevronDown />
              </div>
              {isOpen && <div className="sos-answer-box">{entry.answer}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SosEntrySection({ title, section, entries, sosProgress, onToggleMastery, onBack, onHome }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const normalizedProgress = normalizeSosProgress(sosProgress);
  const mastered = normalizedProgress.mastered[section] || {};
  const summary = summarizeSosProgress(normalizedProgress, section, entries);
  const selectedEntry = Number.isInteger(selectedIndex) ? entries[selectedIndex] : null;

  const goPrev = () => setSelectedIndex(index => Math.max(0, index - 1));
  const goNext = () => setSelectedIndex(index => Math.min(entries.length - 1, index + 1));

  if (selectedEntry) {
    const isMastered = Boolean(mastered[selectedEntry.id]);
    return (
      <div className="sos-screen fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={() => setSelectedIndex(null)}>
            <Icons.ChevronLeft /> {title}
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Αρχική
          </button>
        </div>
        <div className="oral-viewer-meta">
          <div className="oral-q-counter">{selectedIndex + 1} / {entries.length}</div>
          <span className={`oral-progress-pill ${summary.total > 0 && summary.mastered === summary.total ? "complete" : ""}`}>
            {summary.mastered}/{summary.total} κατακτημένα
          </span>
        </div>
        <h2>{selectedEntry.title}</h2>
        <button
          className={`oral-mastery-toggle ${isMastered ? "mastered" : ""}`}
          onClick={() => onToggleMastery(section, selectedEntry.id, !isMastered)}
        >
          <Icons.Check />
          Mastered
        </button>
        <div className="sos-detail-answer">{selectedEntry.answer}</div>
        <div style={{ height: 80 }} />
        <div className="nav-bar">
          <button className="nav-btn" onClick={goPrev} disabled={selectedIndex === 0}>
            <Icons.ChevronLeft /> Προηγούμενο
          </button>
          <button className="nav-btn" onClick={goNext} disabled={selectedIndex === entries.length - 1}>
            Επόμενο <Icons.ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sos-screen fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> SOS Ψυχιατρικής
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <div className="oral-viewer-meta">
        <h2>{title}</h2>
        <span className={`oral-progress-pill ${summary.total > 0 && summary.mastered === summary.total ? "complete" : ""}`}>
          {summary.mastered}/{summary.total} κατακτημένα
        </span>
      </div>
      <div className="sos-list">
        {entries.map((entry, index) => (
          <button
            key={entry.id}
            className={`sos-list-entry ${mastered[entry.id] ? "mastered" : ""}`}
            onClick={() => setSelectedIndex(index)}
          >
            <span>{entry.title}</span>
            {mastered[entry.id] && <Icons.Check />}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description, icon, onBack, onHome }) {
  return (
    <div className="placeholder-page fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <div className="placeholder-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="results-btn" onClick={onBack}>
        Επιστροφή στην Αρχική
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [screen, setScreen] = useState('home');
  const [testMode, setTestMode] = useState(null);
  const [oralViewerData, setOralViewerData] = useState(null);
  const [oralTableData, setOralTableData] = useState(null);
  const [profileStore, setProfileStore] = useState(() => loadProfileStore());
  const [syncStatus, setSyncStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  const remoteSaveTimerRef = useRef(null);
  const oralRemoteSaveTimerRef = useRef(null);
  const lastRemoteAttemptIdRef = useRef(null);
  const activeProfile = profileStore.activeProfileId
    ? profileStore.profiles[profileStore.activeProfileId]
    : null;
  const mcqProgress = activeProfile?.mcqProgress || createEmptyMcqProgress();
  const oralProgress = activeProfile?.oralProgress || createEmptyOralProgress();
  const sosProgress = activeProfile?.sosProgress || createEmptySosProgress();
  const mcqProgressSummary = useMemo(() => summarizeMcqProgress(mcqProgress), [mcqProgress]);
  const oralProgressSummary = useMemo(() => summarizeOralProgress(oralProgress), [oralProgress]);
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
      if (oralRemoteSaveTimerRef.current) clearTimeout(oralRemoteSaveTimerRef.current);
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
            await saveRemoteAnswerBehavior(profileId, progress, lastRemoteAttemptIdRef.current);
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

  const queueRemoteOralProgressSave = useCallback((profileId, progress) => {
    if (!ONLINE_PROFILES_ENABLED || !profileId) return;

    setSyncStatus("saving");
    if (oralRemoteSaveTimerRef.current) clearTimeout(oralRemoteSaveTimerRef.current);
    oralRemoteSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveRemoteOralProgress(profileId, progress);
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

  const updateOralProgress = useCallback((nextOrUpdater) => {
    const profileId = profileStore.activeProfileId;
    const profile = profileId ? profileStore.profiles[profileId] : null;
    if (!profile) return;

    const currentProgress = profile.oralProgress || createEmptyOralProgress();
    const nextProgress = normalizeOralProgress(
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(currentProgress)
        : nextOrUpdater
    );

    setProfileStore(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [profileId]: {
          ...prev.profiles[profileId],
          oralProgress: nextProgress,
        },
      },
    }));
    queueRemoteOralProgressSave(profileId, nextProgress);
  }, [profileStore.activeProfileId, profileStore.profiles, queueRemoteOralProgressSave]);

  const setOralQuestionMastered = useCallback((questionId, mastered) => {
    updateOralProgress(progress => {
      const current = normalizeOralProgress(progress);
      const nextMastered = { ...current.mastered };
      if (mastered) {
        nextMastered[questionId] = true;
      } else {
        delete nextMastered[questionId];
      }

      return {
        ...current,
        mastered: nextMastered,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [updateOralProgress]);

  const setSosEntryMastered = useCallback((section, entryId, mastered) => {
    const profileId = profileStore.activeProfileId;
    const profile = profileId ? profileStore.profiles[profileId] : null;
    if (!profile) return;

    const current = normalizeSosProgress(profile.sosProgress);
    const nextSection = { ...(current.mastered[section] || {}) };
    if (mastered) {
      nextSection[entryId] = true;
    } else {
      delete nextSection[entryId];
    }

    const nextProgress = {
      ...current,
      mastered: {
        ...current.mastered,
        [section]: nextSection,
      },
      updatedAt: new Date().toISOString(),
    };

    setProfileStore(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [profileId]: {
          ...prev.profiles[profileId],
          sosProgress: nextProgress,
        },
      },
    }));

    if (ONLINE_PROFILES_ENABLED) {
      setSyncStatus("saving");
      saveRemoteSosMastery(profileId, section, entryId, mastered)
        .then(() => setSyncStatus("online"))
        .catch(() => setSyncStatus("offline"));
    }
  }, [profileStore.activeProfileId, profileStore.profiles]);

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
          <OralChoiceScreen
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
            onOpenPastTopics={() => {
              setOralViewerData(null);
              setOralTableData(null);
              setScreen('oral-past');
            }}
            onOpenSimulator={() => setScreen('oral-simulator')}
          />
        )}
        {activeProfile && screen === 'oral-past' && (
          <OralAccordion
            onBack={() => setScreen('oral')}
            onHome={() => setScreen('home')}
            onNavigateToViewer={(questions, title) => {
              setOralViewerData({ questions, title });
              setScreen('oral-viewer');
            }}
            onNavigateToTable={(rows) => {
              setOralTableData(rows);
              setScreen('oral-table');
            }}
            oralProgress={oralProgress}
          />
        )}
        {activeProfile && screen === 'oral-simulator' && (
          <OralExamSimulator
            onBack={() => setScreen('oral')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'oral-viewer' && oralViewerData && (
          <OralQuestionViewer
            questions={oralViewerData.questions}
            title={oralViewerData.title}
            oralProgress={oralProgress}
            onQuestionMastered={setOralQuestionMastered}
            onBack={() => setScreen('oral-past')}
            onHome={() => { setOralViewerData(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'oral-table' && oralTableData && (
          <OralTable
            rows={oralTableData}
            onBack={() => setScreen('oral-past')}
            onHome={() => { setOralTableData(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'sos' && (
          <SosHome
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
            onOpenSection={(sectionId) => setScreen(`sos-${sectionId}`)}
          />
        )}
        {activeProfile && screen === 'sos-numbers' && (
          <SosNumbersList
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'sos-critical' && (
          <SosEntrySection
            title="Κρίσιμα Θέματα"
            section="critical_topics"
            entries={sosCriticalTopics}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'sos-differential' && (
          <SosEntrySection
            title="Διαφοροδιάγνωση"
            section="differential_diagnosis"
            entries={sosDifferentialDiagnosis}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
      </div>
    </>
  );
}

