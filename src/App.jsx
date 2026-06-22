import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import QUESTIONS from "./data/questions.js";
import oralData from "./data/oral.js";
import oralCoreQuestions from "./data/oralCore.js";
import { sosNumbers, sosCriticalTopics, sosDifferentialDiagnosis } from "./data/sos.js";
import { highYieldPsychiatryTables } from "./data/highYieldPsychiatryTables.js";
import mcqVignettes from "./data/mcqVignettes.js";
import mcqMatchingSets from "./data/mcqMatching.js";
import dsm5trSelfExamChapters, { dsm5trSelfExamQuestions } from "./data/dsm5trSelfExamQuestions.js";
import { oxfordBoxes } from "./data/oxfordBoxes.js";
import { crashCourseBoxes } from "./data/crashCourseBoxes.js";

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

function createOptionOrder(question) {
  if (!question || !Array.isArray(question.options)) return [];
  return shuffleItems(question.options.map((_, index) => index));
}

function normalizeOptionOrder(question, order) {
  if (!question || !Array.isArray(question.options)) return [];
  const optionIndexes = question.options.map((_, index) => index);
  if (
    Array.isArray(order) &&
    order.length === optionIndexes.length &&
    new Set(order).size === optionIndexes.length &&
    order.every(index => Number.isInteger(index) && index >= 0 && index < optionIndexes.length)
  ) {
    return order;
  }

  return createOptionOrder(question);
}

function createOptionOrders(questions, existingOrders = {}) {
  return Object.fromEntries(
    questions.map(question => [
      question.id,
      normalizeOptionOrder(question, existingOrders?.[question.id] || existingOrders?.[String(question.id)]),
    ])
  );
}

function getStoredOptionOrder(question, optionOrders = {}) {
  if (!question || !Array.isArray(question.options)) return [];
  const order = optionOrders?.[question.id] || optionOrders?.[String(question.id)];
  const optionIndexes = question.options.map((_, index) => index);
  if (
    Array.isArray(order) &&
    order.length === optionIndexes.length &&
    new Set(order).size === optionIndexes.length &&
    order.every(index => Number.isInteger(index) && index >= 0 && index < optionIndexes.length)
  ) {
    return order;
  }

  return optionIndexes;
}

function getDisplayedOptionIndex(question, originalIndex, optionOrders = {}) {
  const optionOrder = getStoredOptionOrder(question, optionOrders);
  const displayIndex = optionOrder.indexOf(originalIndex);
  return displayIndex >= 0 ? displayIndex : originalIndex;
}

function getDisplayedOptionLetter(question, originalIndex, optionOrders = {}) {
  if (!Number.isInteger(originalIndex)) return "-";
  return OPTION_LETTERS[getDisplayedOptionIndex(question, originalIndex, optionOrders)] || "-";
}

function normalizeGreekSearch(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .trim();
}

function getBoxSourceKey(box) {
  return String(box?.source || "").toLowerCase().includes("crash") ? "crash" : "oxford";
}

function getBoxesForSource(sourceKey) {
  const boxes = sourceKey === "crash" ? crashCourseBoxes : oxfordBoxes;
  return [...boxes].sort((a, b) => {
    if (sourceKey === "crash") return (Number(a.order) || 0) - (Number(b.order) || 0);
    const chapterDiff = (Number(a.chapter) || 0) - (Number(b.chapter) || 0);
    if (chapterDiff) return chapterDiff;
    return String(a.boxNumber || "").localeCompare(String(b.boxNumber || ""), undefined, { numeric: true });
  });
}

function getRandomBoxIndex(boxes, currentIndex = -1) {
  if (!boxes.length) return -1;
  if (boxes.length === 1) return 0;
  let next = currentIndex;
  while (next === currentIndex) {
    next = Math.floor(Math.random() * boxes.length);
  }
  return next;
}

function getBoxSearchText(box) {
  return normalizeGreekSearch([
    box.source,
    box.chapter ? `chapter ${box.chapter} κεφάλαιο ${box.chapter}` : "",
    box.boxNumber ? `box ${box.boxNumber} ${box.boxNumber}` : "",
    box.page ? `page ${box.page} pg ${box.page} σελίδα ${box.page}` : "",
    box.title,
    box.content,
  ].join(" "));
}

function getBoxContentLines(content) {
  if (Array.isArray(content)) {
    return content.map(line => String(line || "").trim()).filter(Boolean);
  }

  const text = String(content || "").trim();
  if (!text) return [];
  const explicitLines = text.split(/\r?\n+/).map(line => line.trim()).filter(Boolean);
  if (explicitLines.length > 1) return explicitLines;

  return text
    .replace(/\.([Α-ΩA-Z])/g, ".\n$1")
    .replace(/([)])([Α-ΩA-Z])/g, "$1\n$2")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function isBoxHeadingLine(line) {
  const value = String(line || "").trim();
  return value.startsWith("Κατά ") || value === "Αυτοσκοπικές ψευδαισθήσεις";
}

const MCQ_PROGRESS_STORAGE_KEY = "psychiatry-mcq-progress-v1";
const PROFILE_STORAGE_KEY = "psychiatry-study-profiles-v1";
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const ONLINE_PROFILES_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SUPABASE_PROFILE_TABLE = "study_profiles";
const SUPABASE_APP_SETTINGS_TABLE = "app_settings";
const UPDATE_MESSAGE_SETTING_KEY = "home_update_message";
const DEFAULT_UPDATE_MESSAGE = "\u039c\u03bf\u03b9\u03c1\u03b1\u03c3\u03c4\u03b5\u03af\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b5\u03c6\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c5\u03c0\u03b5\u03cd\u03b8\u03b7\u03bd\u03b1.";
const MASTERY_STREAK_TARGET = 3;
const DAILY_CHALLENGE_SIZE = 10;
const SPRINT_SESSION_SIZE = 10;
const WEAKNESS_SESSION_SIZE = 15;
const WRITTEN_EXAM_SIZE = 100;
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
const MCQ_TOPIC_CATEGORIES = [
  "\u03a8\u03c5\u03c7\u03bf\u03c0\u03b1\u03b8\u03bf\u03bb\u03bf\u03b3\u03af\u03b1",
  "\u03a8\u03c5\u03c7\u03c9\u03c4\u03b9\u03ba\u03ad\u03c2 \u03b4\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2",
  "\u0394\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2 \u03b4\u03b9\u03ac\u03b8\u03b5\u03c3\u03b7\u03c2",
  "\u0391\u03b3\u03c7\u03ce\u03b4\u03b5\u03b9\u03c2, \u0399\u03a8\u0394 \u03ba\u03b1\u03b9 \u03c4\u03c1\u03b1\u03cd\u03bc\u03b1",
  "\u039d\u03b5\u03c5\u03c1\u03bf\u03b1\u03bd\u03b1\u03c0\u03c4\u03c5\u03be\u03b9\u03b1\u03ba\u03ad\u03c2 \u03ba\u03b1\u03b9 \u03c0\u03b1\u03b9\u03b4\u03bf\u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
  "\u039d\u03b5\u03c5\u03c1\u03bf\u03bb\u03bf\u03b3\u03b9\u03ba\u03ad\u03c2 \u03ba\u03b1\u03b9 \u039f\u03c1\u03b3\u03b1\u03bd\u03b9\u03ba\u03ad\u03c2 \u0394\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2",
  "\u0394\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2 \u03c7\u03c1\u03ae\u03c3\u03b7\u03c2 \u03bf\u03c5\u03c3\u03b9\u03ce\u03bd",
  "\u03a8\u03c5\u03c7\u03bf\u03c6\u03b1\u03c1\u03bc\u03b1\u03ba\u03bf\u03bb\u03bf\u03b3\u03af\u03b1",
  "\u0392\u03b9\u03bf\u03bb\u03bf\u03b3\u03b9\u03ba\u03ad\u03c2 \u03b8\u03b5\u03c1\u03b1\u03c0\u03b5\u03af\u03b5\u03c2",
  "\u0395\u03c0\u03b5\u03af\u03b3\u03bf\u03c5\u03c3\u03b1 \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
  "\u039a\u03b1\u03c4\u03b1\u03c4\u03bf\u03bd\u03af\u03b1 \u03ba\u03b1\u03b9 \u03ba\u03b9\u03bd\u03b7\u03c4\u03b9\u03ba\u03ad\u03c2 \u03b4\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2",
  "\u0394\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2 \u03c0\u03c1\u03bf\u03c3\u03c9\u03c0\u03b9\u03ba\u03cc\u03c4\u03b7\u03c4\u03b1\u03c2",
  "\u0394\u03b9\u03b1\u03c4\u03c1\u03bf\u03c6\u03b9\u03ba\u03ad\u03c2 \u03b4\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2",
  "\u0394\u03b9\u03b1\u03c4\u03b1\u03c1\u03b1\u03c7\u03ad\u03c2 \u03cd\u03c0\u03bd\u03bf\u03c5",
  "\u03a3\u03c9\u03bc\u03b1\u03c4\u03b9\u03ba\u03ac, \u03b1\u03c0\u03bf\u03c3\u03c5\u03bd\u03b4\u03b5\u03c4\u03b9\u03ba\u03ac \u03ba\u03b1\u03b9 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03b9\u03ba\u03ac \u03c3\u03c5\u03bc\u03c0\u03c4\u03ce\u03bc\u03b1\u03c4\u03b1",
  "\u03a3\u03b5\u03be\u03bf\u03c5\u03b1\u03bb\u03b9\u03ba\u03cc\u03c4\u03b7\u03c4\u03b1, \u03c6\u03cd\u03bb\u03bf \u03ba\u03b1\u03b9 \u03c0\u03b5\u03c1\u03b9\u03b3\u03b5\u03bd\u03bd\u03b7\u03c4\u03b9\u03ba\u03ae \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
  "\u03a8\u03c5\u03c7\u03bf\u03b8\u03b5\u03c1\u03b1\u03c0\u03b5\u03af\u03b1",
  "\u039d\u03bf\u03bc\u03b9\u03ba\u03ac, \u03b4\u03b5\u03bf\u03bd\u03c4\u03bf\u03bb\u03bf\u03b3\u03af\u03b1 \u03ba\u03b1\u03b9 forensic",
  "\u0399\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae \u03ba\u03b1\u03b9 liaison",
  "\u03a8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae \u03b7\u03bb\u03b9\u03ba\u03b9\u03c9\u03bc\u03ad\u03bd\u03c9\u03bd",
  "\u0399\u03c3\u03c4\u03bf\u03c1\u03af\u03b1, \u03ad\u03c1\u03b5\u03c5\u03bd\u03b1 \u03ba\u03b1\u03b9 \u03c4\u03b1\u03be\u03b9\u03bd\u03cc\u03bc\u03b7\u03c3\u03b7"
];
const MCQ_FEEDBACK_OPTIONS = [
  { value: "duplicate", label: "Duplicate" },
  { value: "too_easy_wording", label: "Υπερβολικά Εύκολη" },
  { value: "wrong_terminology", label: "Λάθος ορολογία" },
  { value: "wrong_or_uncertain_answer", label: "Λάθος/Αμφίβολη Απάντηση" },
];
const MCQ_QUALITY_FEEDBACK = {
  up: "quality_up",
  down: "quality_down",
};
const MCQ_TEXT_OVERRIDES = {
  875: {
    stem: "Ποιο κύκλωμα συνδέεται περισσότερο με παθολογική ανησυχία;",
  },
};
function hasBrokenQuestionText(text) {
  return typeof text === "string" && (text.includes("???") || text.includes("\uFFFD"));
}

function getMcqStem(question) {
  if (!question) return "";
  const override = MCQ_TEXT_OVERRIDES[question.id] || MCQ_TEXT_OVERRIDES[String(question.id)];
  if (override?.stem) return override.stem;
  return hasBrokenQuestionText(question.stem) ? "" : question.stem;
}

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
    writtenExamSessions: [],
    writtenExamDraft: null,
    vignettes: { completed: {}, updatedAt: null },
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
    writtenExamSessions: Array.isArray(progress.writtenExamSessions) ? progress.writtenExamSessions : [],
    writtenExamDraft: normalizeWrittenExamDraft(progress.writtenExamDraft),
    vignettes: {
      completed: progress.vignettes?.completed && typeof progress.vignettes.completed === "object"
        ? progress.vignettes.completed
        : {},
      updatedAt: progress.vignettes?.updatedAt || null,
    },
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

  const body = await response.text();
  if (!body) return null;
  return JSON.parse(body);
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

  const body = await response.text();
  if (!body) return null;
  return JSON.parse(body);
}

async function loadRemoteUpdateMessage() {
  const rows = await supabaseTableRequest(SUPABASE_APP_SETTINGS_TABLE, {
    select: "key,value,updated_at",
    key: `eq.${UPDATE_MESSAGE_SETTING_KEY}`,
    limit: "1",
  });
  const value = rows?.[0]?.value;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_UPDATE_MESSAGE;
}

async function saveRemoteUpdateMessage(message) {
  const value = String(message || "").trim() || DEFAULT_UPDATE_MESSAGE;
  await supabaseTableRequest(
    SUPABASE_APP_SETTINGS_TABLE,
    { on_conflict: "key" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        key: UPDATE_MESSAGE_SETTING_KEY,
        value,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return value;
}

async function saveMcqFeedback(questionId, feedbackType, optionalMetadata = {}) {
  const feedbackComment = typeof optionalMetadata.feedbackComment === "string"
    ? optionalMetadata.feedbackComment.trim()
    : "";
  const basePayload = {
    question_id: String(questionId),
    feedback_type: feedbackType,
  };
  const metadataPayload = {
    ...basePayload,
    question_text_snapshot: optionalMetadata.questionTextSnapshot || null,
    topic: optionalMetadata.topic || null,
    subtopic: optionalMetadata.subtopic || null,
    feedback_comment: feedbackComment || null,
  };
  const insertFeedback = payload => supabaseTableRequest(
    "mcq_feedback",
    {},
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    }
  );

  try {
    return await insertFeedback(metadataPayload);
  } catch (error) {
    const message = String(error?.message || "");
    const isOptionalColumnProblem = /column|schema cache|PGRST204|record .* has no field/i.test(message);
    if (!isOptionalColumnProblem) throw error;
    if (feedbackComment) throw error;
    return insertFeedback(basePayload);
  }
}

function getMcqFeedbackErrorMessage(error) {
  const detail = String(error?.message || "");

  if (/Online profiles are not configured/i.test(detail)) {
    return "Could not save feedback. Supabase is not configured.";
  }

  if (/feedback_comment|schema cache|PGRST204|record .* has no field/i.test(detail)) {
    return "Could not save feedback. Add the feedback_comment column to mcq_feedback.";
  }

  if (/relation .*mcq_feedback.* does not exist|Could not find the table|PGRST205|mcq_feedback/i.test(detail)) {
    return "Could not save feedback. Run the mcq_feedback SQL in Supabase.";
  }

  if (/row-level security|permission denied|42501|violates row-level security/i.test(detail)) {
    return "Could not save feedback. Check mcq_feedback RLS policies in Supabase.";
  }

  return "Could not save feedback. Check the Supabase mcq_feedback table.";
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

async function saveRemoteQuestionStates(profileId, progress, questionIds) {
  const rows = [...new Set(questionIds.map(String))]
    .map(questionId => {
      const questionState = progress.questions?.[questionId] || progress.questions?.[Number(questionId)];
      if (!questionState) return null;

      return {
        profile_id: profileId,
        question_id: questionId,
        seen_count: questionState.seenCount || questionState.attempts || (questionState.seenAt ? 1 : 0),
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
      };
    })
    .filter(Boolean);

  if (!rows.length) return;

  await supabaseTableRequest(
    "user_question_state",
    { on_conflict: "profile_id,question_id" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
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

function calculateStandardPoints({ isCorrect, mode, currentStreak }) {
  if (!isCorrect) return { base: 0, speed: 0, streak: 0, total: 0 };
  const base = mode === "weakness" ? 120 : 100;
  const streak = Math.min(currentStreak * 20, 120);
  return { base, speed: 0, streak, total: base + streak };
}

function inferAnswerConfidence() {
  return 3;
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
  const recentDailyRepeats = getRecentDailyQuestionRepeatCount(progress, question.id);
  let score = 0;

  score += Math.min(wrongCount, 5) * 50;
  if ((record.consecutiveWrong || 0) >= 2) score += 80;
  else if ((record.consecutiveWrong || 0) === 1) score += 45;
  if ((record.confidentWrongCount || 0) > 0) score += Math.min(record.confidentWrongCount, 4) * 25;
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
  const records = progress.questions || {};
  const shuffled = selectRandomQuestions(QUESTIONS.length);
  const usedIds = new Set();
  const unseenQueue = shuffled.filter(question => !hasSeenQuestion(records[question.id]));
  const lightlySeenQueue = shuffled.filter(question => {
    const record = records[question.id];
    return hasSeenQuestion(record) && getSeenCount(record) <= 1 && !isQuestionMastered(record);
  });
  const fallbackQueue = shuffled.filter(question => !isQuestionMastered(records[question.id]) || isDue(records[question.id], now));
  const reviewCandidates = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForRandomReview(question, progress, now) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);
  const randomQueue = [...unseenQueue, ...lightlySeenQueue, ...fallbackQueue, ...shuffled];
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

function getMcqTopicCounts() {
  const counts = new Map(MCQ_TOPIC_CATEGORIES.map(topic => [topic, 0]));
  QUESTIONS.forEach(question => {
    const topic = getQuestionTopic(question);
    counts.set(topic, (counts.get(topic) || 0) + 1);
  });
  return counts;
}

function getQuestionsForMcqTopic(topic) {
  if (!topic) return [];
  return QUESTIONS.filter(question => getQuestionTopic(question) === topic);
}

function getQuestionExamLesson(question) {
  return firstQuestionField(question, ["examLesson", "exam_lesson", "examTip", "exam_tip", "lesson"]);
}

function getQuestionSignature(question) {
  const stopWords = new Set([
    "which", "what", "with", "from", "that", "this", "most", "best", "following", "patient", "correct",
    "ποιο", "ποια", "ποιος", "ποιας", "ποιον", "ποια", "ειναι", "στην", "στον", "στις", "στους",
    "απο", "για", "και", "την", "τον", "της", "του", "των", "μια", "ενα", "ενας", "ασθενης",
    "καταλληλοτερη", "σωστη", "απαντηση", "περισσοτερο", "λιγοτερο",
  ]);
  const tokens = normalizeQuestionText(question?.stem)
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter(token => token.length > 3 && !stopWords.has(token));

  return tokens.slice(0, 18).join(" ") || `question-${question?.id}`;
}

function getQuestionSignatureTokens(question) {
  const signature = getQuestionSignature(question);
  return new Set(signature.split(/\s+/).filter(Boolean));
}

function isNearDuplicateQuestion(candidate, selectedQuestions) {
  const candidateTokens = getQuestionSignatureTokens(candidate);
  if (candidateTokens.size < 5) return false;

  return selectedQuestions.some(existing => {
    if (getQuestionTopic(existing) !== getQuestionTopic(candidate)) return false;
    const existingTokens = getQuestionSignatureTokens(existing);
    if (existingTokens.size < 5) return false;
    let overlap = 0;
    candidateTokens.forEach(token => {
      if (existingTokens.has(token)) overlap += 1;
    });
    const smaller = Math.min(candidateTokens.size, existingTokens.size);
    return smaller > 0 && overlap / smaller >= 0.72;
  });
}

function getQuestionConceptTags(question) {
  const text = getQuestionSearchText(question);
  const tags = [];
  const addIf = (tag, pattern) => {
    if (pattern.test(text)) tags.push(tag);
  };

  addIf("delirium", /\bdelirium\b|παραληρη|ντελιρ|οξεια συγχυ|διακυμανση προσοχ|διακυμανση συνειδησ/);
  addIf("catatonia", /\bcatatoni|κατατον/);
  addIf("nms", /\bnms\b|νευροληπτικο κακοηθ|κακοηθες νευροληπτικ/);
  addIf("serotonin_syndrome", /serotonin syndrome|σεροτονιν/);
  addIf("suicide", /suicid|αυτοκτον/);
  addIf("lithium", /lithium|λιθι/);
  addIf("clozapine", /clozapine|κλοζαπ/);
  addIf("alcohol_withdrawal", /alcohol withdrawal|στερηση αλκοολ|τρομωδες παραληρημα|delirium tremens/);

  return [...new Set(tags)];
}

const WRITTEN_CONCEPT_CAPS = {
  delirium: 4,
  catatonia: 3,
  nms: 2,
  serotonin_syndrome: 2,
  suicide: 4,
  lithium: 4,
  clozapine: 3,
  alcohol_withdrawal: 3,
};

function getLatestQuestionAttempt(progress, questionId, mode = null) {
  return (progress.attempts || []).find(attempt =>
    String(attempt.questionId) === String(questionId) &&
    (!mode || attempt.mode === mode)
  ) || null;
}

function scoreQuestionForWrittenExam(question, progress, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const attempts = getAttemptsCount(record);
  const wrongCount = getWrongCount(record);
  const mastery = getMasteryLevel(record);
  const accuracy = getAccuracy(record);
  const seen = hasSeenQuestion(record);
  const mastered = isQuestionMastered(record);
  const daysSinceAnswer = getDaysSince(record.lastAnsweredAt || record.seenAt, now);
  const latestWrittenAttempt = getLatestQuestionAttempt(progress, question.id, "written");
  const daysSinceWritten = getDaysSince(latestWrittenAttempt?.attemptedAt, now);
  let score = Math.random() * 8;

  if (!seen) score += 70;
  if (isWeaknessCandidate(question, progress)) score += Math.min(90, scoreQuestionForWeakness(question, progress, now));
  if (wrongCount > 0) score += Math.min(wrongCount, 5) * 16;
  if ((record.consecutiveWrong || 0) > 0) score += Math.min(record.consecutiveWrong, 3) * 22;
  if ((record.confidentWrongCount || 0) > 0) score += Math.min(record.confidentWrongCount, 4) * 14;
  if (attempts >= 3 && accuracy !== null && accuracy < 0.7) score += 28;
  if (isDue(record, now)) score += mastered ? 26 : 42;
  if (mastery > 0 && mastery < 3) score += 32;
  else if (mastery >= 3 && mastery < 5) score += 18;
  if (daysSinceAnswer === null) score += 12;
  else if (daysSinceAnswer >= 60) score += 24;
  else if (daysSinceAnswer >= 30) score += 16;
  else if (daysSinceAnswer >= 14) score += 8;

  if (mastered) {
    score -= 26;
    if (daysSinceAnswer !== null && daysSinceAnswer >= 30) score += 18;
  }

  if (daysSinceWritten !== null) {
    if (daysSinceWritten <= 3) score -= 90;
    else if (daysSinceWritten <= 14) score -= 45;
    else if (daysSinceWritten <= 30) score -= 18;
  }

  score -= Math.max(0, getSeenCount(record) - 3) * 3;
  return score;
}

function buildWrittenTopicQuotas(eligible, targetCount) {
  const topicMap = new Map();
  eligible.forEach(question => {
    const topic = getQuestionTopic(question);
    if (!topicMap.has(topic)) topicMap.set(topic, []);
    topicMap.get(topic).push(question);
  });

  const topics = [...topicMap.keys()];
  const majorThreshold = Math.max(80, Math.floor(eligible.length * 0.04));
  const minTopicQuota = targetCount >= 60 ? 2 : 1;
  const maxMajorTopic = Math.max(14, Math.ceil(targetCount * 0.20));
  const maxMinorTopic = Math.max(4, Math.ceil(targetCount * 0.08));
  const quotaRows = topics.map(topic => {
    const available = topicMap.get(topic).length;
    const raw = (available / eligible.length) * targetCount;
    const maxForTopic = available >= majorThreshold ? maxMajorTopic : maxMinorTopic;
    const includeTopic = available >= minTopicQuota && raw >= 0.45;
    const quota = includeTopic
      ? Math.min(available, maxForTopic, Math.max(minTopicQuota, Math.floor(raw)))
      : 0;
    return { topic, available, raw, quota, remainder: raw - Math.floor(raw) };
  });

  let total = quotaRows.reduce((sum, row) => sum + row.quota, 0);

  while (total > targetCount) {
    const row = quotaRows
      .filter(item => item.quota > minTopicQuota)
      .sort((a, b) => a.remainder - b.remainder || b.quota - a.quota)[0];
    if (!row) break;
    row.quota -= 1;
    total -= 1;
  }

  while (total < targetCount) {
    const row = quotaRows
      .filter(item => {
        const maxForTopic = item.available >= majorThreshold ? maxMajorTopic : maxMinorTopic;
        return item.quota > 0 && item.quota < item.available && item.quota < maxForTopic;
      })
      .sort((a, b) => b.remainder - a.remainder || b.available - a.available)[0];
    if (!row) break;
    row.quota += 1;
    total += 1;
  }

  return new Map(quotaRows.filter(row => row.quota > 0).map(row => [row.topic, row.quota]));
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
  const now = new Date();
  const records = progress.questions || {};
  const topicQuotas = buildWrittenTopicQuotas(eligible, targetCount);
  const selected = [];
  const usedIds = new Set();
  const usedSignatures = new Set();
  const conceptCounts = new Map();

  const canUseQuestion = (question, { respectConceptCaps = true } = {}) => {
    if (!question || usedIds.has(question.id)) return false;
    const signature = getQuestionSignature(question);
    if (usedSignatures.has(signature)) return false;
    if (isNearDuplicateQuestion(question, selected)) return false;
    if (respectConceptCaps) {
      const conceptTags = getQuestionConceptTags(question);
      for (const tag of conceptTags) {
        const cap = WRITTEN_CONCEPT_CAPS[tag];
        if (Number.isInteger(cap) && (conceptCounts.get(tag) || 0) >= cap) return false;
      }
    }
    return true;
  };

  const pushQuestion = (question, options = {}) => {
    if (!canUseQuestion(question, options)) return false;
    const signature = getQuestionSignature(question);
    usedIds.add(question.id);
    usedSignatures.add(signature);
    getQuestionConceptTags(question).forEach(tag => {
      conceptCounts.set(tag, (conceptCounts.get(tag) || 0) + 1);
    });
    selected.push(question);
    return true;
  };

  const rank = (questions) => questions
    .map(question => ({ question, score: scoreQuestionForWrittenExam(question, progress, now) }))
    .sort((a, b) => b.score - a.score);

  const pickFrom = (candidates, target, limitCount = targetCount) => {
    const take = Math.max(0, Math.min(target, limitCount - selected.length, targetCount - selected.length));
    if (!take) return;

    let picked = 0;
    for (const item of candidates) {
      if (picked >= take || selected.length >= targetCount || selected.length >= limitCount) break;
      if (pushQuestion(item.question || item)) picked += 1;
    }
  };

  for (const [topic, quota] of topicQuotas) {
    const topicLimit = selected.length + quota;
    const topicQuestions = eligible.filter(question => getQuestionTopic(question) === topic);
    const topicUnseen = rank(topicQuestions.filter(question => !hasSeenQuestion(records[question.id])));
    const topicWeak = rank(topicQuestions.filter(question => isWeaknessCandidate(question, progress)));
    const topicDue = rank(topicQuestions.filter(question => {
      const record = records[question.id];
      return hasSeenQuestion(record) && !isQuestionMastered(record) && isDue(record, now);
    }));
    const topicMastered = rank(topicQuestions.filter(question => {
      const record = records[question.id];
      const daysSinceAnswer = getDaysSince(record?.lastAnsweredAt || record?.seenAt, now);
      return isQuestionMastered(record) && (isDue(record, now) || daysSinceAnswer === null || daysSinceAnswer >= 30);
    }));
    const topicLearning = rank(topicQuestions.filter(question => {
      const record = records[question.id];
      return hasSeenQuestion(record) && !isQuestionMastered(record);
    }));
    const topicBroad = rank(topicQuestions);

    pickFrom(topicUnseen, Math.ceil(quota * 0.75), topicLimit);
    pickFrom(topicWeak, Math.max(quota >= 6 ? 1 : 0, Math.round(quota * 0.15)), topicLimit);
    pickFrom(topicDue, Math.max(quota >= 10 ? 1 : 0, Math.round(quota * 0.08)), topicLimit);
    pickFrom(topicMastered, quota >= 10 ? 1 : 0, topicLimit);
    pickFrom(topicLearning, topicLimit - selected.length, topicLimit);
    pickFrom(topicBroad, topicLimit - selected.length, topicLimit);
  }

  let unseenSelected = selected.filter(question => !hasSeenQuestion(records[question.id])).length;
  const unseenMinimum = Math.min(
    eligible.filter(question => !hasSeenQuestion(records[question.id])).length,
    Math.floor(targetCount * 0.70) + 1
  );
  if (unseenSelected < unseenMinimum) {
    const unseenTopUp = rank(eligible.filter(question => !hasSeenQuestion(records[question.id])));
    for (const item of unseenTopUp) {
      if (unseenSelected >= unseenMinimum) break;
      const candidate = item.question;
      const candidateSignature = getQuestionSignature(candidate);
      if (!canUseQuestion(candidate)) continue;

      const replaceIndex = selected.findLastIndex(question => {
        const record = records[question.id];
        return hasSeenQuestion(record) &&
          !isWeaknessCandidate(question, progress) &&
          !isDue(record, now);
      });
      if (replaceIndex < 0) break;

      const removed = selected[replaceIndex];
      usedIds.delete(removed.id);
      usedSignatures.delete(getQuestionSignature(removed));
      getQuestionConceptTags(removed).forEach(tag => {
        conceptCounts.set(tag, Math.max(0, (conceptCounts.get(tag) || 0) - 1));
      });
      selected[replaceIndex] = candidate;
      usedIds.add(candidate.id);
      usedSignatures.add(candidateSignature);
      getQuestionConceptTags(candidate).forEach(tag => {
        conceptCounts.set(tag, (conceptCounts.get(tag) || 0) + 1);
      });
      unseenSelected += 1;
    }
  }

  const broadCandidates = rank(eligible);
  pickFrom(broadCandidates, targetCount - selected.length);
  if (selected.length < targetCount) {
    for (const item of broadCandidates) {
      if (selected.length >= targetCount) break;
      pushQuestion(item.question, { respectConceptCaps: false });
    }
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

function makeWrittenExamSessionId() {
  return `written-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getQuestionById(questionId) {
  const normalizedId = Number(questionId);
  return QUESTIONS.find(question => question.id === questionId || question.id === normalizedId) || null;
}

function normalizeWrittenExamDraft(draft) {
  if (!draft || typeof draft !== "object") return null;

  const questionIds = Array.isArray(draft.questionIds)
    ? draft.questionIds.filter(id => getQuestionById(id))
    : [];
  if (!questionIds.length) return null;

  const answers = draft.answers && typeof draft.answers === "object" ? draft.answers : {};
  const currentIdx = Number.isInteger(draft.currentIdx)
    ? Math.max(0, Math.min(draft.currentIdx, questionIds.length - 1))
    : 0;
  const optionOrders = createOptionOrders(
    questionIds.map(getQuestionById).filter(Boolean),
    draft.optionOrders && typeof draft.optionOrders === "object" ? draft.optionOrders : {}
  );

  return {
    id: draft.id || draft.sessionId || makeWrittenExamSessionId(),
    sessionId: draft.sessionId || draft.id || makeWrittenExamSessionId(),
    questionIds,
    answers,
    currentIdx,
    optionOrders,
    viewedQuestionIds: Array.isArray(draft.viewedQuestionIds) ? [...new Set(draft.viewedQuestionIds.map(String))] : [],
    recordedAnswerQuestionIds: Array.isArray(draft.recordedAnswerQuestionIds)
      ? [...new Set(draft.recordedAnswerQuestionIds.map(String))]
      : [],
    startedAt: draft.startedAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };
}

function getWrittenExamDraft(progress) {
  return normalizeWrittenExamDraft(progress?.writtenExamDraft);
}

function getWrittenExamDraftQuestions(draft) {
  const normalizedDraft = normalizeWrittenExamDraft(draft);
  if (!normalizedDraft) return [];
  return normalizedDraft.questionIds.map(getQuestionById).filter(Boolean);
}

function createWrittenExamDraft(questions, {
  sessionId = makeWrittenExamSessionId(),
  currentIdx = 0,
  answers = {},
  optionOrders = {},
  viewedQuestionIds = [],
  recordedAnswerQuestionIds = [],
  startedAt = new Date().toISOString(),
} = {}) {
  const questionIds = questions.map(question => question.id);
  return normalizeWrittenExamDraft({
    id: sessionId,
    sessionId,
    questionIds,
    answers,
    currentIdx,
    optionOrders: createOptionOrders(questions, optionOrders),
    viewedQuestionIds,
    recordedAnswerQuestionIds,
    startedAt,
    updatedAt: new Date().toISOString(),
  });
}

function saveWrittenExamDraft(progress, draft) {
  const normalizedDraft = normalizeWrittenExamDraft(draft);
  if (!normalizedDraft) return progress;

  return {
    ...progress,
    writtenExamDraft: normalizedDraft,
    updatedAt: new Date().toISOString(),
  };
}

function clearWrittenExamDraft(progress) {
  return {
    ...progress,
    writtenExamDraft: null,
    updatedAt: new Date().toISOString(),
  };
}

function recordWrittenDraftView(progress, draft, questionId) {
  const questionKey = String(questionId);
  const viewedQuestionIds = [...new Set([...(draft.viewedQuestionIds || []), questionKey])];
  const viewedDraft = { ...draft, viewedQuestionIds, updatedAt: new Date().toISOString() };
  return saveWrittenExamDraft(markQuestionSeen(progress, questionId), viewedDraft);
}

function recordWrittenDraftAnswer(progress, draft, question, selected) {
  const questionKey = String(question.id);
  const recorded = new Set((draft.recordedAnswerQuestionIds || []).map(String));
  const answers = { ...(draft.answers || {}), [question.id]: selected };

  if (recorded.has(questionKey)) {
    return saveWrittenExamDraft(progress, { ...draft, answers, updatedAt: new Date().toISOString() });
  }

  recorded.add(questionKey);
  const nextProgress = recordQuestionAnswer(progress, question, selected, {
    mode: "written",
    confidence: 3,
    timeTakenMs: null,
    pointsAwarded: selected === question.correct ? 100 : 0,
    pointBreakdown: null,
    sessionId: draft.sessionId,
    streakPosition: 0,
  });

  return saveWrittenExamDraft(nextProgress, {
    ...draft,
    answers,
    recordedAnswerQuestionIds: [...recorded],
    updatedAt: new Date().toISOString(),
  });
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

function recordWrittenExamSession(progress, session) {
  const currentSessions = Array.isArray(progress.writtenExamSessions) ? progress.writtenExamSessions : [];
  const sessions = [session, ...currentSessions.filter(item => item.id !== session.id)];

  return {
    ...progress,
    writtenExamSessions: sessions,
    updatedAt: new Date().toISOString(),
  };
}

function getWrittenExamSessions(progress) {
  return [...(progress.writtenExamSessions || [])].sort((a, b) => {
    return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
  });
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

function getPercentageColorClass(scorePercent) {
  if (scorePercent >= 99) return "pink";
  if (scorePercent >= 91) return "orange";
  if (scorePercent >= 80) return "purple";
  if (scorePercent >= 70) return "blue";
  if (scorePercent >= 50) return "green";
  return "gray";
}

const SOS_NUMBER_PATTERN = /(?:DSM|ICD)-?\s*\d+(?:[.,]\d+)?|(?:≥|≤|>|<|~|≈)?\s*\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:%|mmol\/L|mEq\/L|mg\/dL|mg|g|kg|mL|L|ημέρες|ημέρα|εβδομάδες|εβδομάδα|μήνες|μήνας|έτη|ετών|ώρες|ωρών|λεπτά|bpm|kg\/m²)?/gi;

function renderSosNumberText(text) {
  const parts = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SOS_NUMBER_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (!value.trim()) continue;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    if (/^\s*(DSM|ICD)-?\s*\d/i.test(value)) {
      parts.push(value);
    } else {
      parts.push(
        <span className="sos-number-mark" key={`${index}-${value}`}>
          {value}
        </span>
      );
    }
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function getSosNumberFact(entry) {
  return `${entry.title} - ${entry.answer}`;
}

function buildBreakdown(items, getLabel) {
  const map = new Map();

  items.forEach(item => {
    const labels = getLabel(item.question);
    const normalizedLabels = Array.isArray(labels) && labels.length ? labels : [labels || "Uncategorized"];

    normalizedLabels.forEach(label => {
      const normalizedLabel = String(label || "Uncategorized");
      const current = map.get(normalizedLabel) || { label: normalizedLabel, total: 0, correct: 0, wrong: 0, unanswered: 0 };
      current.total += 1;
      if (item.selected === undefined || item.selected === null) current.unanswered += 1;
      else if (item.isCorrect) current.correct += 1;
      else current.wrong += 1;
      map.set(normalizedLabel, current);
    });
  });

  return [...map.values()]
    .map(row => ({
      ...row,
      percent: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function buildLifetimeTopicStats(progress) {
  const map = new Map();
  QUESTIONS.forEach(question => {
    const topic = getQuestionTopic(question);
    const record = getQuestionProgress(progress || {}, question.id);
    const correct = record.correctCount || 0;
    const wrong = getWrongCount(record);
    const answered = correct + wrong;
    if (!answered) return;

    const current = map.get(topic) || { label: topic, correct: 0, wrong: 0, answered: 0 };
    current.correct += correct;
    current.wrong += wrong;
    current.answered += answered;
    map.set(topic, current);
  });

  return map;
}

function buildTopicPerformance(items, progress) {
  const lifetimeStats = buildLifetimeTopicStats(progress);
  return buildBreakdown(items, question => getQuestionTopic(question)).map(row => {
    const lifetime = lifetimeStats.get(row.label);
    const lifetimePercent = lifetime?.answered
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

    return {
      ...row,
      lifetimeCorrect: lifetime?.correct || 0,
      lifetimeWrong: lifetime?.wrong || 0,
      lifetimeAnswered: lifetime?.answered || 0,
      lifetimePercent,
      currentScoreClass: getPercentageColorClass(row.percent),
      lifetimeScoreClass: lifetimePercent === null ? "empty" : getPercentageColorClass(lifetimePercent),
    };
  });
}

function getWrittenExamResult(questions, answers, progress = null) {
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
    items,
    topicBreakdown: buildBreakdown(items, question => getQuestionTopic(question)),
    topicPerformance: buildTopicPerformance(items, progress),
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
  ThumbsUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
      <path d="M7 10v11"/>
      <path d="M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.7-.9L15 3a2.6 2.6 0 0 1 0 2.9z"/>
    </svg>
  ),
  ThumbsDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
      <path d="M17 14V3"/>
      <path d="M9 18.1 10 14H4.2a2 2 0 0 1-2-2.3l1.2-7a2 2 0 0 1 2-1.7H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2.8a2 2 0 0 0-1.7.9L9 21a2.6 2.6 0 0 1 0-2.9z"/>
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

  .home-update-note {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 2px auto 14px;
    padding: 8px 12px;
    border: 1px solid rgba(59,130,246,0.28);
    border-radius: var(--radius-sm);
    background: rgba(59,130,246,0.1);
    color: #bfdbfe;
    font-size: 13px;
    line-height: 1.4;
    font-family: inherit;
    cursor: pointer;
  }

  .home-update-note strong {
    color: #dbeafe;
    font-weight: 700;
  }

  .home-update-editor {
    width: min(520px, calc(100vw - 48px));
    margin: 0 auto 14px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }

  .home-update-editor textarea {
    width: 100%;
    resize: vertical;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text);
    padding: 10px 12px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.4;
  }

  .home-update-editor-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 10px;
  }

  .home-update-status {
    color: var(--text-dim);
    font-size: 12px;
    margin: -6px auto 12px;
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
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 4px 8px;
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

  .written-history {
    margin-top: 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
  }

  .written-history h3 {
    font-size: 14px;
    margin: 0 0 6px;
    color: var(--text);
  }

  .written-history-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }

  .written-history-row:first-of-type {
    border-top: none;
  }

  .written-history-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.3;
    flex-wrap: wrap;
  }

  .written-history-date {
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .written-history-detail {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.3;
    white-space: nowrap;
  }

  .written-history-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--text-muted);
    flex: 0 0 auto;
  }

  .written-history-score {
    align-self: center;
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }

  .written-history-score.pink { color: #f472b6; }
  .written-history-score.orange { color: var(--gold); }
  .written-history-score.purple { color: #a855f7; }
  .written-history-score.blue { color: var(--accent); }
  .written-history-score.green { color: var(--green); }
  .written-history-score.gray { color: var(--text-muted); }

  @media (max-width: 520px) {
    .written-history-row {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .written-history-score {
      justify-self: start;
    }
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
    font-family: 'DM Sans', sans-serif;
  }

  .mcq-feedback-controls {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
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

  .mcq-quality-btn {
    width: 31px;
    height: 31px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.18s;
  }

  .mcq-quality-btn.up {
    border-color: rgba(34,197,94,0.35);
    color: var(--green);
  }

  .mcq-quality-btn.down {
    border-color: rgba(239,68,68,0.35);
    color: var(--red);
  }

  .mcq-quality-btn.up:hover {
    background: var(--green-bg);
    border-color: rgba(34,197,94,0.65);
  }

  .mcq-quality-btn.down:hover {
    background: var(--red-bg);
    border-color: rgba(239,68,68,0.65);
  }

  .mcq-quality-btn:disabled {
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

  .mcq-feedback-comment {
    border-top: 1px solid var(--border);
    padding: 10px;
  }

  .mcq-feedback-comment textarea {
    width: 100%;
    min-height: 76px;
    resize: vertical;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
    padding: 9px 10px;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.45;
    outline: none;
  }

  .mcq-feedback-comment textarea:focus {
    border-color: rgba(59,130,246,0.55);
  }

  .mcq-feedback-comment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .mcq-feedback-comment-actions button {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card-hover);
    color: var(--text-dim);
    padding: 6px 9px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .mcq-feedback-comment-actions button.primary {
    background: var(--blue-bg);
    border-color: rgba(59,130,246,0.45);
    color: var(--blue);
  }

  .mcq-feedback-comment-actions button:disabled {
    opacity: 0.55;
    cursor: default;
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
    font-family: 'DM Sans', Arial, sans-serif;
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
  .structured-mcq {
    max-width: 980px;
    margin: 0 auto;
    padding: 32px 24px 120px;
  }

  .structured-mcq h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 34px;
    font-weight: 400;
    margin-bottom: 16px;
  }

  .structured-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px;
    margin-bottom: 18px;
  }

  .structured-card.compact {
    padding: 16px;
  }

  .vignette-text {
    white-space: pre-line;
    color: var(--text);
    font-size: 15px;
    line-height: 1.75;
  }

  .vignette-open-btn {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text);
    padding: 14px 16px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    margin-bottom: 18px;
  }

  .vignette-question-card {
    min-height: 720px;
    display: flex;
    flex-direction: column;
  }

  .vignette-question-card .structured-options {
    flex: 1;
  }

  .vignette-question-card .structured-option {
    min-height: 78px;
    align-items: center;
  }

  .vignette-question-card .structured-actions {
    margin-top: auto;
  }

  .structured-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .structured-progress {
    color: var(--text-dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .structured-question {
    color: var(--text);
    font-size: 20px;
    line-height: 1.55;
    margin-bottom: 18px;
  }

  .structured-instruction {
    color: var(--text-muted);
    font-size: 13px;
    margin-bottom: 14px;
  }

  .structured-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .structured-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    padding: 14px 16px;
    font-family: inherit;
    font-size: 15px;
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
  }

  .structured-option.selected {
    border-color: var(--border-active);
    background: var(--accent-soft);
  }

  .structured-option.correct {
    border-color: var(--green);
    background: var(--green-bg);
  }

  .structured-option.incorrect {
    border-color: var(--red);
    background: var(--red-bg);
  }

  .structured-option-letter,
  .choice-id {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-surface);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
  }

  .structured-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 22px;
  }

  .structured-actions-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .extra-chapter-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 18px;
  }

  .extra-chapter-row {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    color: var(--text);
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .extra-chapter-row.featured {
    border-color: var(--border-active);
    background: var(--accent-soft);
  }

  .extra-chapter-row:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .extra-chapter-title {
    color: var(--text);
    font-size: 16px;
    font-weight: 700;
  }

  .extra-session-header,
  .extra-session-stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .extra-session-header span,
  .extra-session-stats span {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg-surface);
    color: var(--text-dim);
    padding: 7px 11px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .extra-question-card {
    padding: 26px;
  }

  .extra-question-stem {
    font-size: 17px;
    line-height: 1.65;
  }

  .extra-option {
    min-height: 72px;
    align-items: flex-start;
  }

  .extra-option-text {
    white-space: pre-line;
  }

  .extra-explanation {
    display: flex;
    flex-direction: column;
    gap: 8px;
    white-space: pre-line;
    line-height: 1.65;
    text-align: left;
  }

  .extra-empty-note {
    color: var(--text-dim);
    line-height: 1.55;
  }

  .extra-review-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .extra-result-modal {
    max-width: 520px;
  }

  .extra-nav-row {
    justify-content: center;
  }

  .choice-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .choice-card {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    padding: 12px;
    font-size: 14px;
    line-height: 1.4;
    font-family: inherit;
    text-align: left;
  }

  .choice-card.selectable {
    cursor: pointer;
  }

  .choice-card.selected {
    border-color: var(--border-active);
    background: var(--accent-soft);
  }

  .vignette-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .vignette-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: stretch;
    gap: 10px;
  }

  .vignette-open-card,
  .vignette-complete-toggle {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    font-family: inherit;
    cursor: pointer;
  }

  .vignette-open-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    font-size: 15px;
    text-align: left;
  }

  .vignette-complete-toggle {
    min-width: 150px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .vignette-complete-toggle.active {
    border-color: var(--green);
    background: var(--green-bg);
    color: var(--green);
  }

  .choice-card.correct {
    border-color: var(--green);
    background: var(--green-bg);
  }

  .choice-card.incorrect {
    border-color: var(--red);
    background: var(--red-bg);
  }

  .sticky-choices {
    position: sticky;
    top: 8px;
    z-index: 5;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 18px;
  }

  .sticky-choices .choice-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .vignette-modal {
    width: min(980px, calc(100vw - 48px));
    max-width: 980px;
    max-height: 88vh;
    overflow-y: auto;
    text-align: left;
  }

  .vignette-modal-close {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

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

  .results-score.pink { color: #f472b6; }
  .results-score.orange { color: var(--gold); }
  .results-score.purple { color: #a855f7; }
  .results-score.blue { color: var(--accent); }
  .results-score.green { color: var(--green); }
  .results-score.gray { color: var(--text-muted); }

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

  .modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-dim);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .modal-close svg {
    width: 16px;
    height: 16px;
  }

  .extra-password-modal {
    position: relative;
  }

  .extra-password-modal input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text);
    padding: 12px 14px;
    margin: 10px 0 14px;
    font-family: inherit;
    font-size: 16px;
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

  .written-topic-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px;
    margin: 16px 0;
  }

  .written-topic-panel h3 {
    color: var(--text);
    font-size: 15px;
    margin-bottom: 14px;
  }

  .topic-performance-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .topic-performance-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(320px, 1.25fr);
    gap: 14px;
    align-items: center;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }

  .topic-performance-row:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .topic-performance-main strong {
    display: block;
    color: var(--text);
    font-size: 14px;
    margin-bottom: 4px;
  }

  .topic-performance-main span {
    color: var(--text-dim);
    font-size: 13px;
  }

  .topic-performance-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .topic-percent-card {
    background: rgba(15, 23, 42, 0.42);
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
  }

  .topic-percent-card span,
  .topic-percent-card small {
    display: block;
    color: var(--text-dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .topic-percent-card small {
    margin-top: 3px;
    text-transform: none;
    letter-spacing: 0;
  }

  .topic-percent-value {
    display: block;
    font-size: 19px;
    line-height: 1;
    margin: 5px 0;
    font-variant-numeric: tabular-nums;
  }

  .topic-percent-value.pink { color: #f472b6; }
  .topic-percent-value.orange { color: var(--gold); }
  .topic-percent-value.purple { color: #a855f7; }
  .topic-percent-value.blue { color: var(--accent); }
  .topic-percent-value.green { color: var(--green); }
  .topic-percent-value.gray,
  .topic-percent-value.empty { color: var(--text-muted); }

  .topic-percent-bar {
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.16);
  }

  .topic-percent-fill {
    height: 100%;
    min-width: 2px;
    border-radius: inherit;
  }

  .topic-percent-fill.pink { background: #f472b6; }
  .topic-percent-fill.orange { background: var(--gold); }
  .topic-percent-fill.purple { background: #a855f7; }
  .topic-percent-fill.blue { background: var(--accent); }
  .topic-percent-fill.green { background: var(--green); }
  .topic-percent-fill.gray,
  .topic-percent-fill.empty { background: var(--text-muted); }

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

  .wrong-full-btn {
    margin-left: auto;
    border: 1px solid var(--border-active);
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-light);
    padding: 6px 10px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .wrong-full-btn:hover {
    border-color: var(--accent);
    background: rgba(59,130,246,0.16);
  }

  .written-full-question {
    background: transparent;
  }

  .written-full-question-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .written-full-question .question-num {
    margin-bottom: 0;
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
    gap: 14px;
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

  .sos-number-list {
    display: grid;
    gap: 13px;
  }

  .sos-number-entry {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: linear-gradient(135deg, rgba(17,24,39,0.94), rgba(21,29,46,0.86));
    padding: 13px 15px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
    letter-spacing: 0.01em;
    text-align: left;
  }

  .sos-number-entry:nth-child(3n + 1) .sos-number-mark {
    color: var(--gold);
  }

  .sos-number-entry:nth-child(3n + 2) .sos-number-mark {
    color: #60a5fa;
  }

  .sos-number-entry:nth-child(3n) .sos-number-mark {
    color: #34d399;
  }

  .sos-number-mark {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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

  .sos-flip-list {
    display: grid;
    gap: 18px;
  }

  .sos-flip-card {
    width: 100%;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    color: var(--text);
    padding: 15px 17px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }

  .sos-flip-card:hover {
    border-color: var(--border-active);
    background: var(--bg-card-hover);
    transform: translateY(-1px);
  }

  .sos-flip-card.flipped {
    background: linear-gradient(135deg, rgba(20,83,45,0.18), rgba(30,41,59,0.92));
    border-color: rgba(34,197,94,0.32);
  }

  .sos-flip-text {
    color: var(--text);
    font-size: 15px;
    line-height: 1.45;
    font-weight: 620;
  }

  .pinakakia-screen {
    max-width: 920px;
    margin: 0 auto;
    padding: 20px;
  }

  .pinakakia-topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .pinakakia-search-wrap {
    margin: 0 0 24px;
  }

  .pinakakia-search {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    color: var(--text);
    padding: 14px 16px;
    font-family: inherit;
    font-size: 15px;
    outline: none;
  }

  .pinakakia-search:focus {
    border-color: var(--border-active);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .pinakakia-results,
  .pinakakia-list {
    display: grid;
    gap: 12px;
  }

  .pinakakia-section-title {
    margin: 0 0 18px;
    font-size: 25px;
    letter-spacing: 0;
  }

  .pinakakia-card,
  .pinakakia-row {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    color: var(--text);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }

  .pinakakia-card {
    min-height: 96px;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    font-size: 21px;
    font-weight: 800;
  }

  .pinakakia-row {
    padding: 16px 18px;
  }

  .pinakakia-card:hover,
  .pinakakia-row:hover {
    border-color: var(--border-active);
    background: var(--bg-card-hover);
    transform: translateY(-1px);
  }

  .pinakakia-row-title {
    display: block;
    font-size: 16px;
    font-weight: 800;
    margin-bottom: 5px;
  }

  .pinakakia-row-meta,
  .pinakakia-viewer-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.4;
  }

  .pinakakia-empty {
    padding: 24px;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    color: var(--text-dim);
    background: rgba(17,24,39,0.55);
  }

  .pinakakia-viewer {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
    padding: 26px;
  }

  .pinakakia-reveal {
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--text);
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .pinakakia-reveal-placeholder {
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fce7f3;
    font-size: 22px;
    font-weight: 800;
    text-align: center;
  }

  .pinakakia-book-box {
    overflow: hidden;
    border: 1px solid rgba(244,114,182,0.35);
    border-radius: var(--radius-sm);
    background: rgba(244,114,182,0.12);
  }

  .pinakakia-book-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    gap: 16px;
    padding: 13px 16px 10px;
    border-bottom: 1px solid rgba(244,114,182,0.45);
    color: #f472b6;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .pinakakia-book-header-title {
    color: #fce7f3;
  }

  .pinakakia-book-box.oxford {
    border-color: rgba(52,211,153,0.48);
    background: rgba(16,185,129,0.12);
  }

  .pinakakia-book-box.oxford .pinakakia-book-header {
    border-bottom-color: rgba(52,211,153,0.5);
    color: #34d399;
  }

  .pinakakia-book-box.oxford .pinakakia-book-header-title {
    color: #d1fae5;
  }

  .pinakakia-book-box.oxford .pinakakia-book-body {
    background: rgba(16,185,129,0.08);
  }

  .pinakakia-book-header-page {
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 800;
    text-transform: none;
  }

  .pinakakia-book-body {
    padding: 18px 22px 24px;
    background: rgba(244,114,182,0.08);
  }

  .pinakakia-content-text {
    color: var(--text);
    font-size: 19px;
    line-height: 1.55;
    white-space: normal;
  }

  .pinakakia-content-line {
    margin: 0 0 8px;
  }

  .pinakakia-content-line.heading {
    margin-top: 14px;
    margin-bottom: 6px;
    color: var(--text);
    font-weight: 900;
  }

  .pinakakia-content-line.item {
    padding-left: 24px;
  }

  .pinakakia-content-line:first-child {
    margin-top: 0;
  }

  .pinakakia-content-line:last-child {
    margin-bottom: 0;
  }

  .pinakakia-hide-note {
    margin: 0 0 14px;
    color: var(--accent);
    font-size: 14px;
    font-weight: 800;
    text-align: center;
  }

  .pinakakia-viewer-nav {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .home-title { font-size: 32px; }
    .profile-form { flex-direction: column; }
    .mcq-memory { grid-template-columns: 1fr; }
    .game-hud { grid-template-columns: repeat(2, 1fr); }
    .written-result-grid,
    .written-breakdown-grid { grid-template-columns: 1fr; }
    .topic-performance-row { grid-template-columns: 1fr; }
    .topic-performance-stats { grid-template-columns: 1fr; }
    .breakdown-row { flex-direction: column; gap: 4px; }
    .breakdown-row strong { white-space: normal; }
    .nav-bar { gap: 6px; padding: 12px 16px; }
    .nav-btn { padding: 8px 12px; font-size: 13px; }
    .sprint-auto-toggle { right: 12px; bottom: 68px; }
    .vignette-row { grid-template-columns: 1fr; }
    .vignette-complete-toggle { min-height: 44px; }
    .vignette-question-card { min-height: 680px; }
    .vignette-question-card .structured-option { min-height: 66px; }
    .pinakakia-viewer { padding: 18px; }
    .pinakakia-viewer-nav { grid-template-columns: 1fr; }
    .pinakakia-content-text { font-size: 16px; }
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
                  <small>
                    <span>MCQ {summary.mastered} mastered</span>
                    <span>{summary.review} review</span>
                    <span>Oral {oralSummary.mastered}/{oralSummary.total}</span>
                  </small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeScreen({ onNavigate, profileName, onSwitchProfile, updateMessage, updateMessageStatus, onSaveUpdateMessage }) {
  const [updateClickCount, setUpdateClickCount] = useState(0);
  const [isUpdateEditorOpen, setIsUpdateEditorOpen] = useState(false);
  const [updateDraft, setUpdateDraft] = useState(updateMessage || DEFAULT_UPDATE_MESSAGE);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [updateEditorStatus, setUpdateEditorStatus] = useState(null);
  const sections = [
    { id: 'mcq', icon: <Icons.ClipboardCheck />, iconClass: 'blue', title: 'Πολλαπλής Επιλογής', desc: 'Εξάσκηση με ερωτήσεις πολλαπλής επιλογής και αποθηκευμένη πρόοδο', active: true },
    { id: 'oral', icon: <Icons.Mic />, iconClass: 'purple', title: 'Προφορικά', desc: 'Προηγούμενα θέματα και προσομοίωση προφορικής εξέτασης', active: true },
    { id: 'sos', icon: <Icons.BookOpen />, iconClass: 'rose', title: 'SOS Ψυχιατρικής', desc: 'Αριθμοί, πίνακες, κρίσιμα θέματα και διαφοροδιάγνωση', active: true },
    { id: 'pinakakia', icon: <Icons.FileText />, iconClass: 'emerald', title: 'Πινακάκια', desc: 'High-yield boxes από Oxford και Crash Course', active: true },
  ];

  useEffect(() => {
    setUpdateDraft(updateMessage || DEFAULT_UPDATE_MESSAGE);
  }, [updateMessage]);

  const handleUpdateNoteClick = () => {
    setUpdateClickCount(count => {
      const next = count + 1;
      if (next >= 25) {
        setIsUpdateEditorOpen(true);
        setUpdateEditorStatus(null);
        return 0;
      }
      return next;
    });
  };

  const handleSaveUpdateMessage = async (event) => {
    event.preventDefault();
    setIsSavingUpdate(true);
    setUpdateEditorStatus(null);
    try {
      await onSaveUpdateMessage(updateDraft);
      setUpdateEditorStatus('Saved.');
      setIsUpdateEditorOpen(false);
    } catch {
      setUpdateEditorStatus('Could not save update message.');
    } finally {
      setIsSavingUpdate(false);
    }
  };

  return (
    <div className="home fade-in">
      <div className="home-header">
        <div className="home-logo"><Icons.Brain /></div>
        <h1 className="home-title">Εξετάσεις Ειδικότητας</h1>
        <button className="home-update-note" type="button" onClick={handleUpdateNoteClick}>
          <strong>Update:</strong>
          <span>{updateMessage || DEFAULT_UPDATE_MESSAGE}</span>
        </button>
        {updateMessageStatus === 'offline' && (
          <div className="home-update-status">Local update message shown.</div>
        )}
        {isUpdateEditorOpen && (
          <form className="home-update-editor" onSubmit={handleSaveUpdateMessage}>
            <textarea
              value={updateDraft}
              onChange={event => setUpdateDraft(event.target.value)}
              maxLength={180}
              rows={3}
              autoFocus
            />
            <div className="home-update-editor-actions">
              <button className="nav-btn primary" type="submit" disabled={isSavingUpdate}>
                {isSavingUpdate ? 'Saving...' : 'Save update'}
              </button>
              <button className="nav-btn" type="button" onClick={() => setIsUpdateEditorOpen(false)}>
                Cancel
              </button>
            </div>
            {updateEditorStatus && <div className="home-update-status">{updateEditorStatus}</div>}
          </form>
        )}
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

function McqSelect({ onBack, onStart, onHome, progressSummary, writtenExamSessions }) {
  const recentWrittenExamSessions = writtenExamSessions;

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
      <h2>Πολλαπλής Επιλογής</h2>

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

      <button className="mode-btn featured" onClick={() => onStart('sprint')}>
        Mini-test
        <small>10 ερωτήσεις</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('random')}>
        Τυχαία Θέματα
        <small>βαρύτητα σε unseen ερωτήσεις</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('daily')}>
        Αδύναμα Θέματα
        <small>επανάληψη σε λάθος απαντήσεις</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('category')}>
        {"\u0395\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03b1\u03bd\u03ac \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1"}
        <small>{"\u03b5\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03bf\u03c1\u03b3\u03b1\u03bd\u03c9\u03bc\u03ad\u03bd\u03b5\u03c2 \u03bc\u03b5 \u03b2\u03ac\u03c3\u03b7 \u03c4\u03bf \u03b8\u03ad\u03bc\u03b1"}</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('written')}>
        {"\u03a0\u03c1\u03bf\u03c3\u03bf\u03bc\u03bf\u03af\u03c9\u03c3\u03b7 100 \u03a0\u03bf\u03bb\u03bb\u03b1\u03c0\u03bb\u03ae\u03c2"}
        <small>{"\u03b4\u03af\u03bd\u03b5\u03b9 \u03b1\u03c0\u03b1\u03bd\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03bc\u03cc\u03bd\u03bf \u03c3\u03c4\u03bf \u03c4\u03ad\u03bb\u03bf\u03c2"}</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('vignettes')}>
        Vignettes
        <small>κλινικό σενάριο με πολλαπλές ερωτήσεις</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('matching')}>
        Αντιστοίχηση
        <small>επιλογές που χρησιμοποιούνται σε πολλές ερωτήσεις</small>
      </button>
      <button className="mode-btn" onClick={() => onStart('extra')}>
        Extra
      </button>

      {recentWrittenExamSessions.length > 0 && (
        <div className="written-history">
          <h3>Προηγούμενες Προσομοιώσεις</h3>
          {recentWrittenExamSessions.map(session => (
            <div className="written-history-row" key={session.id}>
              <div className="written-history-main">
                <span className="written-history-date">
                  {new Date(session.completedAt).toLocaleDateString("el-GR")}
                </span>
                <span className="written-history-detail">
                  {session.correct}/{session.total} σωστές
                </span>
                {session.unanswered > 0 && (
                  <>
                    <span className="written-history-dot" aria-hidden="true" />
                    <span className="written-history-detail">{session.unanswered} αναπάντητες</span>
                  </>
                )}
                <span className="written-history-dot" aria-hidden="true" />
                <span className="written-history-detail">{session.performanceLabel}</span>
              </div>
              <strong className={`written-history-score ${getPercentageColorClass(session.scorePercent)}`}>
                {session.scorePercent}%
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function McqTopicSelect({ onBack, onHome, onSelectTopic }) {
  const topicCounts = useMemo(() => getMcqTopicCounts(), []);

  return (
    <div className="mcq-select fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:32}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> MCQ Menu
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
      </div>
      <h2>Ερωτήσεις ανά Κατηγορία</h2>

      <div className="extra-chapter-list">
        {MCQ_TOPIC_CATEGORIES.map(topic => {
          const count = topicCounts.get(topic) || 0;
          return (
            <button
              key={topic}
              className="extra-chapter-row"
              disabled={!count}
              onClick={() => onSelectTopic(topic)}
            >
              <span className="extra-chapter-title">{topic}</span>
              <span>{count} ερωτήσεις</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sameSelection(selected, correct) {
  if (!Array.isArray(selected) || !Array.isArray(correct)) return false;
  if (selected.length !== correct.length) return false;
  const selectedSet = new Set(selected);
  return correct.every(value => selectedSet.has(value));
}

function toggleSelection(selected, value, allowMultiple) {
  if (!allowMultiple) return [value];
  return selected.includes(value)
    ? selected.filter(item => item !== value)
    : [...selected, value];
}

function getVignetteLabel(vignette) {
  const match = String(vignette?.id || "").match(/(\d+)$/);
  return match ? `Vignette ${Number(match[1])}` : "Vignette";
}

function getAvailableMatchingSets() {
  return mcqMatchingSets.filter(set => set?.items?.length && set?.choices?.length);
}

function pickRandomMatchingSet(excludeId = null) {
  const sets = getAvailableMatchingSets();
  if (!sets.length) return null;
  const pool = sets.length > 1
    ? sets.filter(set => set.id !== excludeId)
    : sets;
  return pool[Math.floor(Math.random() * pool.length)] || sets[0];
}

function getMatchingSetMenuTitle(set) {
  const title = String(set?.title || "").trim();
  if (!title) return "Αντιστοίχηση";
  const prefix = "Αντιστοίχηση - ";
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title;
}

function getExtraChapterQuestions(chapter) {
  if (!chapter) return [];
  return (chapter.questions || []).map(question => ({
    ...question,
    sourceId: question.sourceId ?? question.id,
    id: `${chapter.id}_q${question.id}`,
    chapter: question.chapter ?? chapter.chapter,
    chapterTitle: question.chapterTitle || chapter.title,
  }));
}

function normalizeExtraCorrectIndex(question) {
  const correct = Array.isArray(question?.correct)
    ? question.correct[0]
    : question?.correct ?? question?.correctIndex ?? question?.answerIndex;

  if (Number.isInteger(correct)) return correct;
  if (typeof correct === "string") {
    const trimmed = correct.trim();
    const letterIndex = OPTION_LETTERS.findIndex(letter => letter.toLowerCase() === trimmed.toLowerCase());
    if (letterIndex >= 0) return letterIndex;
    const exactIndex = (question.options || []).findIndex(option => option.trim() === trimmed);
    if (exactIndex >= 0) return exactIndex;
  }

  return -1;
}

function buildExtraSession(sourceType, chapter = null) {
  const sourceQuestions = sourceType === "random"
    ? dsm5trSelfExamQuestions
    : getExtraChapterQuestions(chapter);

  const eligibleQuestions = sourceQuestions.filter(question => question?.options?.length);
  return sourceType === "random" ? shuffleItems(eligibleQuestions) : eligibleQuestions;
}

function ExtraMcqMode({ onBack, onHome }) {
  const totalExtraQuestions = dsm5trSelfExamQuestions.length;
  const [sessionLabel, setSessionLabel] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [result, setResult] = useState(null);
  const [reviewWrong, setReviewWrong] = useState(false);
  const optionOrders = useMemo(() => createOptionOrders(questions), [questions]);

  const question = questions[currentIdx];
  const selected = question ? answers[question.id] : undefined;
  const isLocked = question ? Boolean(locked[question.id]) : false;
  const answeredRows = questions.map(item => {
    const chosen = answers[item.id];
    const answered = Boolean(locked[item.id]);
    const correct = answered && chosen === normalizeExtraCorrectIndex(item);
    return { question: item, selected: chosen, answered, correct };
  });
  const answeredCount = answeredRows.filter(row => row.answered).length;
  const correctCount = answeredRows.filter(row => row.correct).length;
  const wrongRows = answeredRows.filter(row => row.answered && !row.correct);

  const startSession = (sourceType, chapter = null) => {
    const nextQuestions = buildExtraSession(sourceType, chapter);
    setSessionLabel(sourceType === "random" ? "Random" : `Chapter ${chapter.chapter}: ${chapter.title}`);
    setQuestions(nextQuestions);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setResult(null);
    setReviewWrong(false);
  };

  const backToExtraHome = () => {
    setSessionLabel("");
    setQuestions([]);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setResult(null);
    setReviewWrong(false);
  };

  const lockAnswer = () => {
    if (!question || selected === undefined) return;
    const nextLocked = { ...locked, [question.id]: true };
    setLocked(nextLocked);

    if (questions.every(item => nextLocked[item.id])) {
      const rows = questions.map(item => {
        const chosen = answers[item.id];
        const correct = chosen === normalizeExtraCorrectIndex(item);
        return { question: item, selected: chosen, answered: true, correct };
      });
      const correct = rows.filter(row => row.correct).length;
      setResult({ rows, total: rows.length, correct, wrong: rows.length - correct });
    }
  };

  const renderQuestion = (
    rowQuestion = question,
    rowSelected = selected,
    lockedView = isLocked,
    progressLabel = questions.length > 0 ? `${currentIdx + 1}/${questions.length}` : null
  ) => {
    if (!rowQuestion) return null;
    const correctIndex = normalizeExtraCorrectIndex(rowQuestion);
    const displayedOptions = getStoredOptionOrder(rowQuestion, optionOrders).map(originalIndex => ({
      originalIndex,
      text: rowQuestion.options[originalIndex],
    }));

    return (
      <div className="structured-card extra-question-card">
        <div className="structured-top">
          <span className="structured-progress">{rowQuestion.chapterTitle || "DSM-5-TR Self-Exam"}</span>
          {progressLabel && <span className="structured-progress">{progressLabel}</span>}
        </div>
        <div className="structured-question extra-question-stem">{rowQuestion.stem}</div>
        <div className="structured-options extra-options">
          {displayedOptions.map((option, displayIndex) => {
            let cls = "structured-option extra-option";
            if (!lockedView && option.originalIndex === rowSelected) cls += " selected";
            if (lockedView && option.originalIndex === correctIndex) cls += " correct";
            if (lockedView && option.originalIndex === rowSelected && option.originalIndex !== correctIndex) cls += " incorrect";
            return (
              <button
                key={option.originalIndex}
                type="button"
                className={cls}
                disabled={lockedView}
                onClick={() => setAnswers(prev => ({ ...prev, [rowQuestion.id]: option.originalIndex }))}
              >
                <span className="structured-option-letter">{OPTION_LETTERS[displayIndex] || displayIndex + 1}</span>
                <span className="extra-option-text">{option.text}</span>
              </button>
            );
          })}
        </div>
        {lockedView && (
          <div className="explanation-box extra-explanation">
            <strong>{rowSelected === correctIndex ? "Correct" : "Explanation"}</strong>
            <span>{rowQuestion.explanation || rowQuestion.answer || "No explanation has been added for this question yet."}</span>
          </div>
        )}
      </div>
    );
  };

  if (reviewWrong) {
    return (
      <div className="structured-mcq fade-in">
        <div className="structured-top">
          <button className="back-link" onClick={() => setReviewWrong(false)}>
            <Icons.ChevronLeft /> Results
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Wrong Answer Review</h2>
        {wrongRows.length === 0 ? (
          <div className="structured-card extra-empty-note">No wrong answers in this session.</div>
        ) : (
          <div className="extra-review-list">
            {wrongRows.map((row, index) => (
              <div className="extra-review-item" key={row.question.id}>
                {renderQuestion(row.question, row.selected, true, `Review ${index + 1}/${wrongRows.length}`)}
              </div>
            ))}
          </div>
        )}
        <div className="structured-actions">
          <button className="nav-btn" onClick={() => setReviewWrong(false)}>Back to results</button>
          <button className="nav-btn primary" onClick={backToExtraHome}>Extra menu</button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="structured-mcq fade-in">
        <div className="structured-top">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Extra</h2>
        <div className="structured-card compact extra-empty-note">
          DSM-5-TR Self-Exam bank: {totalExtraQuestions} questions loaded.
        </div>
        <div className="extra-chapter-list">
          <button className="extra-chapter-row featured" disabled={!totalExtraQuestions} onClick={() => startSession("random")}>
            <span className="extra-chapter-title">Random</span>
            <span>{totalExtraQuestions} questions</span>
          </button>
          {dsm5trSelfExamChapters.map(chapter => {
            const count = getExtraChapterQuestions(chapter).length;
            return (
              <button
                key={chapter.id}
                className="extra-chapter-row"
                disabled={!count}
                onClick={() => startSession("chapter", chapter)}
              >
                <span className="extra-chapter-title">Chapter {chapter.chapter}: {chapter.title}</span>
                <span>{count} questions</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="structured-mcq fade-in">
      <div className="structured-top">
        <button className="back-link" onClick={backToExtraHome}>
          <Icons.ChevronLeft /> Extra Menu
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
      </div>
      <h2>{sessionLabel}</h2>
      <div className="extra-session-header">
        <span>{questions.length} total</span>
        <span>{answeredCount} answered</span>
        <span>{correctCount} correct</span>
        <span>{Math.max(0, answeredCount - correctCount)} incorrect</span>
      </div>
      {renderQuestion()}
      <div className="structured-actions extra-nav-row">
        <button className="nav-btn" disabled={currentIdx === 0} onClick={() => setCurrentIdx(index => Math.max(0, index - 1))}>
          <Icons.ChevronLeft />
        </button>
        <button className="nav-btn primary" disabled={selected === undefined || isLocked} onClick={lockAnswer}>
          <Icons.Lock /> Lock
        </button>
        <button className="nav-btn" disabled={currentIdx >= questions.length - 1} onClick={() => setCurrentIdx(index => Math.min(questions.length - 1, index + 1))}>
          <Icons.ChevronRight />
        </button>
      </div>

      {result && (
        <div className="modal-overlay">
          <div className="modal extra-result-modal">
            <h3>Session complete</h3>
            <div className="extra-session-stats">
              <span>{result.correct}/{result.total}</span>
              <span>{Math.round((result.correct / Math.max(1, result.total)) * 100)}%</span>
              <span>{result.wrong} wrong</span>
            </div>
            <div className="modal-actions">
              <button className="results-btn" onClick={() => setReviewWrong(true)}>Review wrong answers</button>
              <button className="results-btn primary" onClick={backToExtraHome}>Extra menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function McqVignetteMode({ progress, onProgressChange, onBack, onHome }) {
  const [selectedVignetteId, setSelectedVignetteId] = useState(null);
  const availableVignettes = useMemo(() => mcqVignettes.filter(Boolean), []);
  const vignette = useMemo(
    () => availableVignettes.find(item => item.id === selectedVignetteId) || availableVignettes[0],
    [availableVignettes, selectedVignetteId]
  );
  const vignetteLabel = getVignetteLabel(vignette);
  const completedVignettes = progress?.vignettes?.completed || {};
  const optionOrders = useMemo(() => createOptionOrders(vignette.questions), [vignette.id]);
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [chosen, setChosen] = useState({});
  const [result, setResult] = useState(null);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [showVignette, setShowVignette] = useState(false);
  const question = vignette.questions[currentIdx];
  const selected = answers[question.id] || [];
  const isLocked = Boolean(locked[question.id]);
  const isChosen = Boolean(chosen[question.id]);
  const allowMultiple = question.correct.length > 1;
  const displayedOptions = getStoredOptionOrder(question, optionOrders).map(originalIndex => ({
    originalIndex,
    text: question.options[originalIndex],
  }));
  const hasDeferredAnswers = vignette.questions.some(item => chosen[item.id] && !locked[item.id]);

  const setVignetteCompleted = (vignetteId, completed) => {
    const now = new Date().toISOString();
    onProgressChange?.(previous => {
      const base = normalizeMcqProgress(previous);
      const currentCompleted = base.vignettes?.completed || {};
      const nextCompleted = { ...currentCompleted };
      if (completed) {
        nextCompleted[vignetteId] = { completed: true, completedAt: now };
      } else {
        delete nextCompleted[vignetteId];
      }
      return {
        ...base,
        vignettes: { completed: nextCompleted, updatedAt: now },
        updatedAt: now,
      };
    });
  };

  const selectVignette = (vignetteId) => {
    setSelectedVignetteId(vignetteId);
    setStarted(false);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setChosen({});
    setResult(null);
    setReviewIdx(null);
    setShowVignette(false);
  };

  const chooseOption = (optionIndex) => {
    if (isLocked) return;
    setAnswers(prev => ({
      ...prev,
      [question.id]: toggleSelection(prev[question.id] || [], optionIndex, allowMultiple),
    }));
  };

  const lockCurrentQuestion = () => {
    if (!selected.length) return;
    setLocked(prev => ({ ...prev, [question.id]: true }));
    setChosen(prev => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
  };

  const chooseCurrentQuestion = () => {
    if (!selected.length || isLocked) return;
    setChosen(prev => ({ ...prev, [question.id]: true }));
  };

  const buildVignetteResult = () => {
    const rows = vignette.questions.map(item => {
      const selectedForQuestion = answers[item.id] || [];
      const answered = selectedForQuestion.length > 0 && (locked[item.id] || chosen[item.id]);
      const correct = answered && sameSelection(selectedForQuestion, item.correct);
      return { question: item, selected: selectedForQuestion, answered, correct };
    });
    const answered = rows.filter(row => row.answered).length;
    const correct = rows.filter(row => row.correct).length;
    const wrong = rows.filter(row => row.answered && !row.correct).length;
    const unanswered = rows.length - answered;
    setResult({ rows, answered, correct, wrong, unanswered, total: rows.length });
  };

  const resetVignette = () => {
    setStarted(false);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setChosen({});
    setResult(null);
    setReviewIdx(null);
    setShowVignette(false);
  };

  if (!selectedVignetteId) {
    return (
      <div className="structured-mcq fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Vignettes</h2>
        <div className="vignette-list">
          {availableVignettes.map(item => {
            const completed = Boolean(completedVignettes[item.id]?.completed || completedVignettes[item.id] === true);
            const label = getVignetteLabel(item);
            const number = label.match(/\d+/)?.[0] || "";
            return (
              <div key={item.id} className={`vignette-row ${completed ? "completed" : ""}`}>
                <button
                  type="button"
                  className="vignette-open-card"
                  onClick={() => selectVignette(item.id)}
                >
                  <span className="choice-id">{number}</span>
                  <span>{label}</span>
                </button>
                <button
                  type="button"
                  className={`vignette-complete-toggle ${completed ? "active" : ""}`}
                  onClick={() => setVignetteCompleted(item.id, !completed)}
                >
                  {completed ? "Completed" : "Mark completed"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const renderVignetteModal = () => showVignette && (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowVignette(false)}>
      <div className="modal vignette-modal" onClick={event => event.stopPropagation()}>
        <div className="vignette-modal-close">
          <button className="nav-btn" type="button" onClick={() => setShowVignette(false)}>
            <Icons.X /> Close
          </button>
        </div>
        <div className="structured-card">
          <div className="structured-top">
            <strong>{vignetteLabel}</strong>
            <span className="structured-progress">{vignette.questions.length} ερωτήσεις</span>
          </div>
          <div className="vignette-text">{vignette.vignette}</div>
        </div>
      </div>
    </div>
  );

  const renderReviewedQuestion = (row, index) => {
    const reviewedQuestion = row.question;
    const reviewedOrder = getStoredOptionOrder(reviewedQuestion, optionOrders).map(originalIndex => ({
      originalIndex,
      text: reviewedQuestion.options[originalIndex],
    }));
    return (
      <div className="structured-card">
        <div className="structured-top">
          <span className="structured-progress">Ερώτηση {index + 1}/{vignette.questions.length}</span>
          <span className="structured-progress">{row.answered ? (row.correct ? "Correct" : "Review") : "Unanswered"}</span>
        </div>
        <div className="structured-question">{reviewedQuestion.stem}</div>
        <div className="structured-options">
          {reviewedOrder.map((option, displayIndex) => {
            const isSelected = row.selected.includes(option.originalIndex);
            const isCorrect = reviewedQuestion.correct.includes(option.originalIndex);
            let cls = "structured-option";
            if (isCorrect) cls += " correct";
            if (isSelected && !isCorrect) cls += " incorrect";
            return (
              <button key={option.originalIndex} type="button" className={cls}>
                <span className="structured-option-letter">{String.fromCharCode(913 + displayIndex)}</span>
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
        <div className="explanation-box">
          <strong>Explanation</strong>
          {reviewedQuestion.explanation}
        </div>
      </div>
    );
  };

  if (result && reviewIdx !== null) {
    const row = result.rows[reviewIdx];
    return (
      <div className="structured-mcq fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={() => setReviewIdx(null)}>
            <Icons.ChevronLeft /> Results
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        {renderReviewedQuestion(row, reviewIdx)}
        <div className="structured-actions">
          <button className="nav-btn" onClick={() => setReviewIdx(index => Math.max(0, index - 1))} disabled={reviewIdx === 0}>
            <Icons.ChevronLeft />
          </button>
          <button className="nav-btn" onClick={() => setReviewIdx(index => Math.min(result.rows.length - 1, index + 1))} disabled={reviewIdx >= result.rows.length - 1}>
            <Icons.ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const percent = result.total ? Math.round((result.correct / result.total) * 100) : 0;
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
        <div className={`results-score ${getPercentageColorClass(percent)}`}>{percent}%</div>
        <div className="results-label">Vignette results</div>
        <div className="results-detail">
          {result.correct}/{result.total} correct, {result.wrong} wrong
          {result.unanswered > 0 ? ", " + result.unanswered + " unanswered" : ""}
        </div>
        <div className="written-result-grid">
          <div className="written-result-stat">
            <strong>{result.correct}</strong>
            <span>Correct</span>
          </div>
          <div className="written-result-stat">
            <strong>{result.wrong}</strong>
            <span>Wrong</span>
          </div>
          <div className="written-result-stat">
            <strong>{result.unanswered}</strong>
            <span>Unanswered</span>
          </div>
        </div>
        <div className="results-actions">
          <button className="results-btn primary" onClick={() => setReviewIdx(0)}>
            Review questions
          </button>
          <button className="results-btn" onClick={resetVignette}>
            Restart vignette
          </button>
          <button className="results-btn" onClick={onBack}>
            MCQ section
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="structured-mcq fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Vignettes</h2>
        <div className="structured-card">
          <div className="structured-top">
            <strong>{vignetteLabel}</strong>
            <span className="structured-progress">{vignette.questions.length} ερωτήσεις</span>
          </div>
          <div className="vignette-text">{vignette.vignette}</div>
        </div>
        <button className="mode-btn featured" onClick={() => setStarted(true)}>
          Έναρξη ερωτήσεων
          <small>το vignette θα είναι διαθέσιμο από κουμπί σε κάθε ερώτηση</small>
        </button>
      </div>
    );
  }

  return (
    <div className="structured-mcq fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> MCQ Menu
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
      </div>

      <button className="vignette-open-btn" type="button" onClick={() => setShowVignette(true)}>
        Προβολή vignette
      </button>

      <div className="structured-card vignette-question-card">
        <div className="structured-top">
          <span className="structured-progress">Ερώτηση {currentIdx + 1}/{vignette.questions.length}</span>
          {isChosen && !isLocked && <span className="structured-progress">Chosen</span>}
        </div>
        <div className="structured-question">{question.stem}</div>
        <div className="structured-options">
          {displayedOptions.map((option, displayIndex) => {
            const isSelected = selected.includes(option.originalIndex);
            const isCorrect = question.correct.includes(option.originalIndex);
            let cls = "structured-option";
            if (!isLocked && isSelected) cls += " selected";
            if (isLocked && isCorrect) cls += " correct";
            if (isLocked && isSelected && !isCorrect) cls += " incorrect";
            return (
              <button key={option.originalIndex} type="button" className={cls} onClick={() => chooseOption(option.originalIndex)}>
                <span className="structured-option-letter">{String.fromCharCode(913 + displayIndex)}</span>
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
        {isLocked && (
          <div className="explanation-box">
            <strong>{sameSelection(selected, question.correct) ? "Correct" : "Review"}</strong>
            {question.explanation}
          </div>
        )}
        <div className="structured-actions">
          <button className="nav-btn" onClick={() => setCurrentIdx(index => Math.max(0, index - 1))} disabled={currentIdx === 0}>
            <Icons.ChevronLeft />
          </button>
          <div className="structured-actions-group">
            {!isLocked && (
              <button className="nav-btn" onClick={chooseCurrentQuestion} disabled={selected.length === 0}>
                Choose
              </button>
            )}
            {!isLocked && (
              <button className="nav-btn primary" onClick={lockCurrentQuestion} disabled={selected.length === 0}>
                <Icons.Lock /> Lock
              </button>
            )}
            {currentIdx === vignette.questions.length - 1 && hasDeferredAnswers && (
              <button className="nav-btn primary" onClick={buildVignetteResult}>
                Submit
              </button>
            )}
            <button className="nav-btn" onClick={() => setCurrentIdx(index => Math.min(vignette.questions.length - 1, index + 1))} disabled={currentIdx >= vignette.questions.length - 1}>
              <Icons.ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {renderVignetteModal()}
    </div>
  );
}

function McqMatchingMode({ onBack, onHome }) {
  const availableSets = useMemo(() => getAvailableMatchingSets(), []);
  const [matchingSet, setMatchingSet] = useState(null);
  const displayChoices = useMemo(() => shuffleItems(matchingSet?.choices || []), [matchingSet?.id]);
  const [showSetMenu, setShowSetMenu] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const item = matchingSet?.items?.[currentIdx];
  const selected = item ? (answers[item.id] || []) : [];
  const isLocked = item ? Boolean(locked[item.id]) : false;
  const allowMultiple = (item?.correct || []).length > 1;

  const resetMatchingProgress = () => {
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
  };

  const startMatchingSet = (nextSet) => {
    if (!nextSet) return;
    setMatchingSet(nextSet);
    setShowSetMenu(false);
    resetMatchingProgress();
  };

  const goToRandomMatchingSet = () => {
    startMatchingSet(pickRandomMatchingSet(matchingSet?.id));
  };

  const openSetMenu = () => {
    setShowSetMenu(true);
    resetMatchingProgress();
  };

  const chooseChoice = (choiceId) => {
    if (!item || isLocked) return;
    setAnswers(prev => ({
      ...prev,
      [item.id]: toggleSelection(prev[item.id] || [], choiceId, allowMultiple),
    }));
  };

  if (!availableSets.length) {
    return (
      <div className="structured-mcq fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Αντιστοίχηση</h2>
        <div className="structured-card">
          <p className="structured-instruction">Δεν υπάρχουν διαθέσιμα τεστ αντιστοίχησης.</p>
        </div>
      </div>
    );
  }

  const renderChoices = (selectable = false) => (
    <div className="choice-grid">
      {displayChoices.map((choice, index) => {
        const isSelected = selected.includes(choice.id);
        const isCorrect = item?.correct.includes(choice.id);
        let cls = "choice-card" + (selectable ? " selectable" : "");
        if (selectable && !isLocked && isSelected) cls += " selected";
        if (selectable && isLocked && isCorrect) cls += " correct";
        if (selectable && isLocked && isSelected && !isCorrect) cls += " incorrect";
        return (
          <button
            key={choice.id}
            type="button"
            className={cls}
            onClick={() => selectable && chooseChoice(choice.id)}
          >
            <span className="choice-id">{String.fromCharCode(945 + index)}</span>
            <span>{choice.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (showSetMenu) {
    return (
      <div className="structured-mcq fade-in">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
            <Icons.ChevronLeft /> MCQ Menu
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
          <button className="nav-btn" type="button" onClick={() => startMatchingSet(pickRandomMatchingSet())}>
            Νέο σετ
          </button>
        </div>
        <h2>Αντιστοίχηση</h2>
        <div className="structured-card">
          <div className="structured-top">
            <strong>Επιλογή σετ</strong>
            <span className="structured-progress">{availableSets.length} θέματα</span>
          </div>
          <div className="structured-options">
            {availableSets.map(set => (
              <button
                key={set.id}
                type="button"
                className="structured-option"
                onClick={() => startMatchingSet(set)}
              >
                <span>{getMatchingSetMenuTitle(set)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!matchingSet || !item) {
    return null;
  }

  return (
    <div className="structured-mcq fade-in">
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
        <button className="back-link" style={{marginBottom:0}} onClick={onBack}>
          <Icons.ChevronLeft /> MCQ Menu
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Home
        </button>
        <button className="nav-btn" type="button" onClick={goToRandomMatchingSet}>
          Νέο σετ
        </button>
        <button className="nav-btn" type="button" onClick={openSetMenu}>
          Επιλογή σετ
        </button>
      </div>
      <div className="structured-card compact" style={{ marginBottom: 16 }}>
        <div className="structured-top">
          <strong>{matchingSet.title}</strong>
          <span className="structured-progress">{matchingSet.items.length} ερωτήσεις</span>
        </div>
        <p className="structured-instruction">{matchingSet.instructions}</p>
      </div>
      <div className="sticky-choices">
        {renderChoices(true)}
      </div>
      <div className="structured-card">
        <div className="structured-top">
          <span className="structured-progress">Ερώτηση {currentIdx + 1}/{matchingSet.items.length}</span>
        </div>
        <div className="structured-question">{item.prompt}</div>
        {isLocked && (
          <div className="explanation-box">
            <strong>{sameSelection(selected, item.correct) ? "Correct" : "Review"}</strong>
            {item.explanation}
          </div>
        )}
        <div className="structured-actions">
          <button className="nav-btn" onClick={() => setCurrentIdx(index => Math.max(0, index - 1))} disabled={currentIdx === 0}>
            <Icons.ChevronLeft />
          </button>
          <div className="structured-actions-group">
            {!isLocked && (
              <button className="nav-btn primary" onClick={() => setLocked(prev => ({ ...prev, [item.id]: true }))} disabled={selected.length === 0}>
                <Icons.Lock /> Lock
              </button>
            )}
            <button className="nav-btn" onClick={() => setCurrentIdx(index => Math.min(matchingSet.items.length - 1, index + 1))} disabled={currentIdx >= matchingSet.items.length - 1}>
              <Icons.ChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function McqTest({ mode, progress, onProgressChange, onBack, onHome, sessionQuestions = null, sessionTitle = null }) {
  const initialWrittenDraftRef = useRef(mode === "written" ? getWrittenExamDraft(progress) : null);
  const initialWrittenQuestionsRef = useRef(initialWrittenDraftRef.current ? getWrittenExamDraftQuestions(initialWrittenDraftRef.current) : null);
  const initialSessionQuestionsRef = useRef(
    initialWrittenQuestionsRef.current?.length
      ? initialWrittenQuestionsRef.current
      : (Array.isArray(sessionQuestions) && sessionQuestions.length ? sessionQuestions : getSessionQuestions(mode, progress))
  );
  const sessionIdRef = useRef(initialWrittenDraftRef.current?.sessionId || `${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const writtenViewedQuestionIdsRef = useRef(new Set(initialWrittenDraftRef.current?.viewedQuestionIds || []));
  const writtenRecordedAnswerIdsRef = useRef(new Set(initialWrittenDraftRef.current?.recordedAnswerQuestionIds || []));
  const startedAtRef = useRef(Date.now());
  const questionViewEffectKeyRef = useRef(null);
  const [questions, setQuestions] = useState(() => initialSessionQuestionsRef.current);
  const [optionOrders, setOptionOrders] = useState(() => createOptionOrders(
    initialSessionQuestionsRef.current,
    initialWrittenDraftRef.current?.optionOrders || {}
  ));
  const [currentIdx, setCurrentIdx] = useState(() => initialWrittenDraftRef.current?.currentIdx || 0);
  const [answers, setAnswers] = useState(() => initialWrittenDraftRef.current?.answers || {});
  const [locked, setLocked] = useState({});
  const [lastBreakdown, setLastBreakdown] = useState(null);
  const [writtenResult, setWrittenResult] = useState(null);
  const [reviewWrittenWrong, setReviewWrittenWrong] = useState(false);
  const [reviewWrittenAll, setReviewWrittenAll] = useState(false);
  const [writtenReviewIndex, setWrittenReviewIndex] = useState(0);
  const [writtenWrongFullItem, setWrittenWrongFullItem] = useState(null);
  const [showWrittenSubmitWarning, setShowWrittenSubmitWarning] = useState(false);
  const [writtenSubmitError, setWrittenSubmitError] = useState(null);
  const [writtenDraftChoice, setWrittenDraftChoice] = useState(() => mode === "written" && Boolean(initialWrittenDraftRef.current) ? "choice" : "active");
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [feedbackSavingType, setFeedbackSavingType] = useState(null);
  const [feedbackCommentOpen, setFeedbackCommentOpen] = useState(false);
  const [feedbackCommentText, setFeedbackCommentText] = useState("");
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
  const currentOptionOrder = q ? getStoredOptionOrder(q, optionOrders) : [];
  const displayedOptions = q
    ? currentOptionOrder.map(originalIndex => ({
        originalIndex,
        text: q.options[originalIndex],
      }))
    : [];
  const isLocked = !!locked[q?.id];
  const questionRecord = getQuestionProgress(progress, q?.id);
  const questionStatus = getQuestionStatus(questionRecord);
  const progressStats = summarizeMcqProgress(progress);
  const prevIdx = currentIdx - 1;
  const nextIdx = currentIdx + 1;
  const dailyReason = mode === "daily" && q ? getDailyReason(progress, q.id) : null;
  const latestAttempt = q
    ? (progress.attempts || []).find(attempt =>
        attempt.sessionId === sessionIdRef.current && attempt.questionId === q.id
      )
    : null;
  const displayedBreakdown = mode === "sprint" ? null : (lastBreakdown || latestAttempt?.pointBreakdown || null);
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
    daily: "Αδύναμα Θέματα",
    random: "Τυχαία Θέματα",
    sprint: "Mini-test",
    weakness: "Αδυναμίες",
    written: "Προσομοίωση με 100 Πολλαπλής",
    category: sessionTitle || "\u0395\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03b1\u03bd\u03ac \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1",
  }[mode] || "MCQ";

  const buildCurrentWrittenDraft = useCallback((overrides = {}) => {
    const draftQuestions = overrides.questions || questions;
    return createWrittenExamDraft(draftQuestions, {
      sessionId: overrides.sessionId || sessionIdRef.current,
      currentIdx: overrides.currentIdx ?? currentIdx,
      answers: overrides.answers || answers,
      optionOrders: overrides.optionOrders || optionOrders,
      viewedQuestionIds: overrides.viewedQuestionIds || [...writtenViewedQuestionIdsRef.current],
      recordedAnswerQuestionIds: overrides.recordedAnswerQuestionIds || [...writtenRecordedAnswerIdsRef.current],
      startedAt: initialWrittenDraftRef.current?.startedAt || new Date(startedAtRef.current).toISOString(),
    });
  }, [answers, currentIdx, optionOrders, questions]);

  const persistWrittenDraft = useCallback((overrides = {}) => {
    if (mode !== "written") return;
    const draft = buildCurrentWrittenDraft(overrides);
    if (!draft) return;
    onProgressChange(prev => saveWrittenExamDraft(prev, draft));
  }, [buildCurrentWrittenDraft, mode, onProgressChange]);

  const goToWrittenIndex = useCallback((index) => {
    if (mode !== "written") {
      setCurrentIdx(index);
      return;
    }

    const boundedIndex = Math.max(0, Math.min(index, totalQ - 1));
    const targetQuestion = questions[boundedIndex];
    setCurrentIdx(boundedIndex);

    const draft = buildCurrentWrittenDraft({ currentIdx: boundedIndex });
    if (!draft) return;

    if (targetQuestion) {
      writtenViewedQuestionIdsRef.current.add(String(targetQuestion.id));
      onProgressChange(prev => recordWrittenDraftView(prev, {
        ...draft,
        viewedQuestionIds: [...writtenViewedQuestionIdsRef.current],
      }, targetQuestion.id));
    } else {
      onProgressChange(prev => saveWrittenExamDraft(prev, draft));
    }
  }, [buildCurrentWrittenDraft, mode, onProgressChange, questions, totalQ]);

  useEffect(() => {
    if (mode !== "daily") return;
    onProgressChange(prev => ensureDailyChallenge(prev).progress);
  }, [mode, onProgressChange]);

  useEffect(() => {
    setOptionOrders(currentOrders => createOptionOrders(questions, currentOrders));
  }, [questions]);

  useEffect(() => {
    if (!q?.id) return;
    if (mode === "written" && writtenDraftChoice === "choice") return;
    const viewEffectKey = `${mode}:${q.id}:${writtenDraftChoice}`;
    if (questionViewEffectKeyRef.current === viewEffectKey) return;
    questionViewEffectKeyRef.current = viewEffectKey;
    startedAtRef.current = Date.now();
    setLastBreakdown(null);
    setFeedbackMenuOpen(false);
    setFeedbackStatus(null);
    setFeedbackCommentOpen(false);
    setFeedbackCommentText("");
    if (mode === "written") {
      writtenViewedQuestionIdsRef.current.add(String(q.id));
      const draft = buildCurrentWrittenDraft({
        currentIdx,
        viewedQuestionIds: [...writtenViewedQuestionIdsRef.current],
      });
      if (draft) onProgressChange(prev => recordWrittenDraftView(prev, draft, q.id));
      return;
    }
    onProgressChange(prev => markQuestionSeen(prev, q.id));
  }, [q?.id, mode, writtenDraftChoice, buildCurrentWrittenDraft, currentIdx, onProgressChange]);

  const goToNextQuestion = useCallback(() => {
    setCurrentIdx(nextIdx);
  }, [nextIdx]);

  const submitAnswer = useCallback((selectedOverride = selected, timedOut = false) => {
    if (mode === "written") return;
    if ((selectedOverride === undefined || selectedOverride === null) && !timedOut) return;
    if (isLocked || !q) return;

    const isCorrect = selectedOverride === q.correct;
    const nextStreak = isCorrect ? sessionStats.currentStreak + 1 : 0;
    const timeTakenMs = Math.max(0, Date.now() - startedAtRef.current);
    const inferredConfidence = inferAnswerConfidence();
    const pointBreakdown = mode === "sprint"
      ? null
      : calculateStandardPoints({ isCorrect, mode, currentStreak: nextStreak });
    const pointsAwarded = pointBreakdown?.total || 0;
    const nextStats = {
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      incorrect: sessionStats.incorrect + (isCorrect ? 0 : 1),
      total: sessionStats.total + 1,
      currentStreak: nextStreak,
      maxStreak: Math.max(sessionStats.maxStreak, nextStreak),
      points: sessionStats.points + pointsAwarded,
    };

    setLocked(prev => ({ ...prev, [q.id]: true }));
    setLastBreakdown(pointBreakdown);
    setSessionStats(nextStats);
    onProgressChange(prev => recordQuestionAnswer(prev, q, selectedOverride, {
      mode,
      confidence: inferredConfidence,
      timeTakenMs,
      pointsAwarded,
      pointBreakdown,
      sessionId: sessionIdRef.current,
      streakPosition: nextStreak,
    }));
  }, [selected, isLocked, q, sessionStats, mode, onProgressChange]);

  const selectOption = (idx) => {
    if (isLocked || writtenResult || !q) return;
    const nextAnswers = { ...answers, [q.id]: idx };
    setAnswers(nextAnswers);

    if (mode === "written") {
      const draft = buildCurrentWrittenDraft({ answers: nextAnswers });
      if (!draft) return;

      onProgressChange(prev => saveWrittenExamDraft(prev, draft));
      return;
    }
  };

  const submitMcqFeedback = async (feedbackType, feedbackComment = "", feedbackQuestion = q) => {
    if (!feedbackQuestion || feedbackSavingType) return;
    const normalizedComment = typeof feedbackComment === "string"
      ? feedbackComment.trim().slice(0, 500)
      : "";
    if (feedbackType === "comment" && !normalizedComment) return;

    setFeedbackSavingType(feedbackType);
    setFeedbackStatus(null);
    try {
      await saveMcqFeedback(feedbackQuestion.id, feedbackType, {
        questionTextSnapshot: getMcqStem(feedbackQuestion),
        topic: getQuestionTopic(feedbackQuestion),
        subtopic: firstQuestionField(feedbackQuestion, ["subtopic", "subTopic", "sub_topic"]),
        feedbackComment: normalizedComment,
      });
      setFeedbackMenuOpen(false);
      setFeedbackCommentOpen(false);
      setFeedbackCommentText("");
      setFeedbackStatus({ type: "success", message: "Feedback saved." });
    } catch (error) {
      console.error("MCQ feedback save failed", error);
      setFeedbackStatus({ type: "error", message: getMcqFeedbackErrorMessage(error) });
    } finally {
      setFeedbackSavingType(null);
    }
  };

  const renderMcqFeedbackControls = (feedbackQuestion = q) => (
    <div className="mcq-feedback-controls">
      <div className="mcq-feedback">
        <button
          type="button"
          className="mcq-feedback-btn"
          onClick={() => {
            if (feedbackMenuOpen) {
              setFeedbackCommentOpen(false);
              setFeedbackCommentText("");
            }
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
                type="button"
                className="mcq-feedback-option"
                onClick={() => submitMcqFeedback(option.value, "", feedbackQuestion)}
                disabled={Boolean(feedbackSavingType)}
              >
                {feedbackSavingType === option.value ? "Saving..." : option.label}
              </button>
            ))}
            <button
              type="button"
              className="mcq-feedback-option"
              onClick={() => {
                setFeedbackCommentOpen(open => !open);
                setFeedbackStatus(null);
              }}
              disabled={Boolean(feedbackSavingType)}
            >
              Σχόλιο
            </button>
            {feedbackCommentOpen && (
              <div className="mcq-feedback-comment">
                <textarea
                  value={feedbackCommentText}
                  onChange={event => setFeedbackCommentText(event.target.value.slice(0, 500))}
                  placeholder="Σύντομο σχόλιο..."
                  maxLength={500}
                  disabled={Boolean(feedbackSavingType)}
                />
                <div className="mcq-feedback-comment-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackCommentOpen(false);
                      setFeedbackCommentText("");
                    }}
                    disabled={Boolean(feedbackSavingType)}
                  >
                    Άκυρο
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => submitMcqFeedback("comment", feedbackCommentText, feedbackQuestion)}
                    disabled={Boolean(feedbackSavingType) || !feedbackCommentText.trim()}
                  >
                    {feedbackSavingType === "comment" ? "Saving..." : "Αποθήκευση"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="mcq-quality-btn up"
        title="Καλή ερώτηση"
        aria-label="Καλή ερώτηση"
        onClick={() => submitMcqFeedback(MCQ_QUALITY_FEEDBACK.up, "", feedbackQuestion)}
        disabled={Boolean(feedbackSavingType)}
      >
        <Icons.ThumbsUp />
      </button>
      <button
        type="button"
        className="mcq-quality-btn down"
        title="Προβληματική ερώτηση"
        aria-label="Προβληματική ερώτηση"
        onClick={() => submitMcqFeedback(MCQ_QUALITY_FEEDBACK.down, "", feedbackQuestion)}
        disabled={Boolean(feedbackSavingType)}
      >
        <Icons.ThumbsDown />
      </button>
    </div>
  );

  const renderLockedWrittenQuestion = (item) => {
    const question = item.question;
    const orderedOptions = getStoredOptionOrder(question, optionOrders).map(originalIndex => ({
      originalIndex,
      text: question.options[originalIndex],
    }));

    return (
      <div className="written-full-question">
        <div className="written-full-question-head">
          <div>
            <div className="question-num">Question {question.id}</div>
          </div>
          {renderMcqFeedbackControls(question)}
        </div>
        {feedbackStatus && (
          <div className={`mcq-feedback-message ${feedbackStatus.type}`}>
            {feedbackStatus.message}
          </div>
        )}
        <div className="question-stem">{getMcqStem(question)}</div>
        <div className="options-list">
          {orderedOptions.map((option, i) => {
            const originalIndex = option.originalIndex;
            const letter = String.fromCharCode(913 + i);
            let cls = "option-btn locked";
            if (originalIndex === question.correct) cls += " correct";
            else if (originalIndex === item.selected && originalIndex !== question.correct) cls += " incorrect";
            return (
              <button key={originalIndex} className={cls} type="button" aria-disabled="true">
                <span className="option-letter">
                  {originalIndex === question.correct ? <Icons.Check /> :
                   originalIndex === item.selected && originalIndex !== question.correct ? <Icons.X /> : letter}
                </span>
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
        <div className="explanation-box">
          <strong>Explanation</strong>{question.explanation}
        </div>
      </div>
    );
  };

  const submitWrittenExam = useCallback((forceSubmit = false) => {
    if (mode !== "written") return;
    if (!forceSubmit) {
      setWrittenSubmitError(null);
      setShowWrittenSubmitWarning(true);
      return;
    }
    if (writtenResult) return;

    try {
      const submittedProgressForResult = recordWrittenExamSubmission(progress, questions, answers, sessionIdRef.current);
      const result = getWrittenExamResult(questions, answers, submittedProgressForResult);
      const sessionSummary = {
        id: sessionIdRef.current,
        questionIds: questions.map(question => question.id),
        completedAt: new Date().toISOString(),
        total: result.total,
        correct: result.correct,
        wrong: result.wrong,
        unanswered: result.unanswered,
        scorePercent: result.scorePercent,
        performanceLabel: result.performance.label,
      };

      setShowWrittenSubmitWarning(false);
      setWrittenSubmitError(null);
      setWrittenResult(result);
      setReviewWrittenWrong(false);
      setReviewWrittenAll(false);
      setWrittenReviewIndex(0);
      setWrittenWrongFullItem(null);

      try {
        onProgressChange(prev => clearWrittenExamDraft(
          recordWrittenExamSession(
            recordWrittenExamSubmission(prev, questions, answers, sessionIdRef.current),
            sessionSummary
          )
        ));
      } catch (progressError) {
        console.error("Written exam progress save failed", progressError);
      }
    } catch (error) {
      console.error("Written exam submission failed", error);
      setWrittenSubmitError("Δεν μπόρεσε να ολοκληρωθεί η υποβολή. Δοκιμάστε ξανά.");
      setShowWrittenSubmitWarning(false);
    }
  }, [answers, mode, onProgressChange, progress, questions, writtenResult]);

  const startNewWrittenExam = useCallback(() => {
    const nextQuestions = getSessionQuestions("written", progress);
    const nextSessionId = makeWrittenExamSessionId();
    const nextOptionOrders = createOptionOrders(nextQuestions);
    const nextDraft = createWrittenExamDraft(nextQuestions, {
      sessionId: nextSessionId,
      currentIdx: 0,
      answers: {},
      optionOrders: nextOptionOrders,
      viewedQuestionIds: [],
      recordedAnswerQuestionIds: [],
    });

    sessionIdRef.current = nextSessionId;
    writtenViewedQuestionIdsRef.current = new Set();
    writtenRecordedAnswerIdsRef.current = new Set();
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setOptionOrders(nextOptionOrders);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setWrittenResult(null);
    setReviewWrittenWrong(false);
    setReviewWrittenAll(false);
    setWrittenReviewIndex(0);
    setWrittenWrongFullItem(null);
    setShowWrittenSubmitWarning(false);
    setWrittenSubmitError(null);
    setWrittenDraftChoice("active");
    setSessionStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      currentStreak: 0,
      maxStreak: 0,
      points: 0,
    });
    if (nextDraft) {
      onProgressChange(prev => saveWrittenExamDraft(clearWrittenExamDraft(prev), nextDraft));
    }
  }, [onProgressChange, progress]);

  const continueWrittenExam = useCallback(() => {
    setWrittenDraftChoice("active");
    persistWrittenDraft();
  }, [persistWrittenDraft]);

  const restartWrittenExam = () => {
    startNewWrittenExam();
  };

  if (mode === "written" && writtenDraftChoice === "choice") {
    const draftUpdatedAt = initialWrittenDraftRef.current?.updatedAt
      ? new Date(initialWrittenDraftRef.current.updatedAt).toLocaleString("el-GR")
      : null;

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

        <div className="oral-choice">
          <h2>Προσομοίωση με 100 Πολλαπλής</h2>
          <p>There is an unfinished written exam saved for this profile.</p>
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
          {draftUpdatedAt && (
            <div className="explanation-box">
              <strong>Saved draft</strong>
              Last updated: {draftUpdatedAt}
            </div>
          )}
          <button className="mode-btn featured" onClick={continueWrittenExam}>
            Continue saved exam
            <small>Resume from question {currentIdx + 1} with your saved selected answers.</small>
          </button>
          <button className="mode-btn" onClick={startNewWrittenExam}>
            Start new exam
            <small>Discard the saved written simulation for this profile and draw a new exam.</small>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "written" && writtenResult && reviewWrittenAll) {
    const reviewItems = writtenResult.items || [];
    const reviewItem = reviewItems[writtenReviewIndex] || reviewItems[0];

    return (
      <div className="test-container written-review fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button
            className="back-link"
            style={{ marginBottom: 0 }}
            onClick={() => {
              setReviewWrittenAll(false);
              setFeedbackMenuOpen(false);
              setFeedbackStatus(null);
              setFeedbackCommentOpen(false);
              setFeedbackCommentText("");
            }}
          >
            <Icons.ChevronLeft /> Αποτελέσματα
          </button>
          <button className="home-btn" onClick={onHome}>
            <Icons.Home /> Home
          </button>
        </div>
        <h2>Όλες οι απαντήσεις</h2>
        {reviewItem ? (
          <>
            {renderLockedWrittenQuestion(reviewItem)}
            <div className="structured-actions">
              <button
                className="nav-btn"
                onClick={() => setWrittenReviewIndex(index => Math.max(0, index - 1))}
                disabled={writtenReviewIndex === 0}
              >
                <Icons.ChevronLeft />
              </button>
              <span className="structured-progress">
                {writtenReviewIndex + 1}/{reviewItems.length}
              </span>
              <button
                className="nav-btn"
                onClick={() => setWrittenReviewIndex(index => Math.min(reviewItems.length - 1, index + 1))}
                disabled={writtenReviewIndex >= reviewItems.length - 1}
              >
                <Icons.ChevronRight />
              </button>
            </div>
          </>
        ) : (
          <div className="explanation-box">
            <strong>Δεν υπάρχουν απαντήσεις</strong>
          </div>
        )}
      </div>
    );
  }

  if (mode === "written" && writtenResult && reviewWrittenWrong) {
    if (writtenWrongFullItem) {
      return (
        <div className="test-container written-review fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
            <button
              className="back-link"
              style={{ marginBottom: 0 }}
              onClick={() => {
                setWrittenWrongFullItem(null);
                setFeedbackMenuOpen(false);
                setFeedbackStatus(null);
                setFeedbackCommentOpen(false);
                setFeedbackCommentText("");
              }}
            >
              <Icons.ChevronLeft /> Wrong answer review
            </button>
            <button className="home-btn" onClick={onHome}>
              <Icons.Home /> Home
            </button>
          </div>
          {renderLockedWrittenQuestion(writtenWrongFullItem)}
        </div>
      );
    }

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
              const subtopic = firstQuestionField(question, ["subtopic", "subTopic", "sub_topic"]);
              return (
                <div className="wrong-answer-card" key={question.id}>
                  <div className="wrong-answer-topline">
                    <span>Question {index + 1}</span>
                    <span>Bank ID {question.id}</span>
                    <button
                      type="button"
                      className="wrong-full-btn"
                      onClick={() => {
                        setWrittenWrongFullItem(item);
                        setFeedbackMenuOpen(false);
                        setFeedbackStatus(null);
                        setFeedbackCommentOpen(false);
                        setFeedbackCommentText("");
                      }}
                    >
                      Full question
                    </button>
                  </div>
                  <div className="wrong-question-stem">{getMcqStem(question)}</div>
                  <div className="written-answer-row incorrect">
                    <strong>Your answer</strong>
                    <span>{getDisplayedOptionLetter(question, item.selected, optionOrders)}. {question.options[item.selected]}</span>
                  </div>
                  <div className="written-answer-row correct">
                    <strong>Correct answer</strong>
                    <span>{getDisplayedOptionLetter(question, question.correct, optionOrders)}. {question.options[question.correct]}</span>
                  </div>
                  <div className="written-meta-row">
                    <span className="meta-pill">{getQuestionTopic(question)}</span>
                    {subtopic && <span className="meta-pill">{subtopic}</span>}
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

        <div className={`results-score ${getPercentageColorClass(writtenResult.scorePercent)}`}>
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

        {writtenResult.topicPerformance?.length > 0 && (
          <div className="written-topic-panel">
            <h3>Απόδοση ανά κατηγορία</h3>
            <div className="topic-performance-list">
              {writtenResult.topicPerformance.map(row => (
                <div className="topic-performance-row" key={row.label}>
                  <div className="topic-performance-main">
                    <strong>{row.label}</strong>
                    <span>
                      Σωστές {row.correct}/{row.total}
                      {row.unanswered > 0 ? ` · Αναπάντητες ${row.unanswered}` : ""}
                    </span>
                  </div>
                  <div className="topic-performance-stats">
                    <div className="topic-percent-card">
                      <span>Τελευταίο τεστ</span>
                      <strong className={`topic-percent-value ${row.currentScoreClass}`}>{row.percent}%</strong>
                      <div className="topic-percent-bar">
                        <div className={`topic-percent-fill ${row.currentScoreClass}`} style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                    <div className="topic-percent-card">
                      <span>Μέσος όρος</span>
                      <strong className={`topic-percent-value ${row.lifetimeScoreClass}`}>
                        {row.lifetimePercent === null ? "—" : `${row.lifetimePercent}%`}
                      </strong>
                      <div className="topic-percent-bar">
                        <div
                          className={`topic-percent-fill ${row.lifetimeScoreClass}`}
                          style={{ width: `${row.lifetimePercent ?? 0}%` }}
                        />
                      </div>
                      <small>{row.lifetimeAnswered} απαντήσεις</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="results-actions">
          <button
            className="results-btn primary"
            onClick={() => {
              setWrittenReviewIndex(0);
              setReviewWrittenAll(true);
            }}
          >
            Προβολή όλων των απαντήσεων
          </button>
          <button className="results-btn primary" onClick={() => setReviewWrittenWrong(true)} disabled={writtenResult.wrongItems.length === 0}>
            Review all wrong answers
          </button>
          <button className="results-btn" onClick={restartWrittenExam}>
            Restart simulation
          </button>
          <button className="results-btn" onClick={onHome}>
            <Icons.Home /> Home
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
          This profile does not have enough eligible questions for this mode yet.
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
            <span className="hud-value">{mode === "sprint" ? currentIdx + 1 : sessionStats.currentStreak}</span>
            <span className="hud-label">{mode === "sprint" ? "Current" : "Streak"}</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{sessionStats.correct}</span>
            <span className="hud-label">Correct</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{sessionStats.incorrect}</span>
            <span className="hud-label">Incorrect</span>
          </div>
          <div className="hud-stat">
            <span className="hud-value">{sessionStats.total}</span>
            <span className="hud-label">Answered</span>
          </div>
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
        <div className="mcq-feedback-controls">
          <div className="mcq-feedback">
            <button
              type="button"
              className="mcq-feedback-btn"
              onClick={() => {
                if (feedbackMenuOpen) {
                  setFeedbackCommentOpen(false);
                  setFeedbackCommentText("");
                }
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
                    type="button"
                    className="mcq-feedback-option"
                    onClick={() => submitMcqFeedback(option.value)}
                    disabled={Boolean(feedbackSavingType)}
                  >
                    {feedbackSavingType === option.value ? "Saving..." : option.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="mcq-feedback-option"
                  onClick={() => {
                    setFeedbackCommentOpen(open => !open);
                    setFeedbackStatus(null);
                  }}
                  disabled={Boolean(feedbackSavingType)}
                >
                  Σχόλιο
                </button>
                {feedbackCommentOpen && (
                  <div className="mcq-feedback-comment">
                    <textarea
                      value={feedbackCommentText}
                      onChange={event => setFeedbackCommentText(event.target.value.slice(0, 500))}
                      placeholder="Σύντομο σχόλιο..."
                      maxLength={500}
                      disabled={Boolean(feedbackSavingType)}
                    />
                    <div className="mcq-feedback-comment-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackCommentOpen(false);
                          setFeedbackCommentText("");
                        }}
                        disabled={Boolean(feedbackSavingType)}
                      >
                        Άκυρο
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => submitMcqFeedback("comment", feedbackCommentText)}
                        disabled={Boolean(feedbackSavingType) || !feedbackCommentText.trim()}
                      >
                        {feedbackSavingType === "comment" ? "Saving..." : "Αποθήκευση"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="mcq-quality-btn up"
            title="Καλή ερώτηση"
            aria-label="Καλή ερώτηση"
            onClick={() => submitMcqFeedback(MCQ_QUALITY_FEEDBACK.up)}
            disabled={Boolean(feedbackSavingType)}
          >
            <Icons.ThumbsUp />
          </button>
          <button
            type="button"
            className="mcq-quality-btn down"
            title="Προβληματική ερώτηση"
            aria-label="Προβληματική ερώτηση"
            onClick={() => submitMcqFeedback(MCQ_QUALITY_FEEDBACK.down)}
            disabled={Boolean(feedbackSavingType)}
          >
            <Icons.ThumbsDown />
          </button>
        </div>
      </div>
      {feedbackStatus && (
        <div className={`mcq-feedback-message ${feedbackStatus.type}`}>
          {feedbackStatus.message}
        </div>
      )}
      {mode === "written" && writtenSubmitError && (
        <div className="mcq-feedback-message error">
          {writtenSubmitError}
        </div>
      )}
      <div className="question-stem">{getMcqStem(q)}</div>

      <div className="options-list">
        {displayedOptions.map((option, i) => {
          const originalIndex = option.originalIndex;
          const letter = String.fromCharCode(913 + i);
          let cls = 'option-btn';
          if (isLocked) {
            cls += ' locked';
            if (originalIndex === q.correct)                                  cls += ' correct';
            else if (originalIndex === selected && originalIndex !== q.correct) cls += ' incorrect';
          } else if (originalIndex === selected) cls += ' selected';
          return (
            <button key={originalIndex} className={cls} onClick={() => selectOption(originalIndex)}>
              <span className="option-letter">
                {isLocked && originalIndex === q.correct ? <Icons.Check /> :
                 isLocked && originalIndex === selected && originalIndex !== q.correct ? <Icons.X /> : letter}
              </span>
              <span>{option.text}</span>
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

      {mode === "written" ? (
        <div className="nav-bar">
          <button className="nav-btn" onClick={() => goToWrittenIndex(prevIdx)} disabled={prevIdx < 0}>
            <Icons.ChevronLeft />
          </button>
          <button className="nav-btn" onClick={() => goToWrittenIndex(nextIdx)} disabled={nextIdx < 0 || nextIdx >= totalQ}>
            <Icons.ChevronRight />
          </button>
          <button className="nav-btn primary" type="button" onClick={() => submitWrittenExam(false)}>
            Submit exam
          </button>
        </div>
      ) : (
        <div className="nav-bar">
          <button className="nav-btn" onClick={() => setCurrentIdx(prevIdx)} disabled={prevIdx < 0}>
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
            disabled={nextIdx < 0 || nextIdx >= totalQ}
          >
            <Icons.ChevronRight />
          </button>
        </div>
      )}

      {showWrittenSubmitWarning && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Written exam submit confirmation">
          <div className="modal">
            <h3>Submit written exam?</h3>
            <p>
              You have answered {writtenAnsweredCount} out of {totalQ} questions.
              {writtenUnansweredCount > 0
                ? ` ${writtenUnansweredCount} question${writtenUnansweredCount === 1 ? "" : "s"} will remain unanswered and count as not correct.`
                : " No questions are unanswered."}
            </p>
            <div className="modal-actions">
              <button className="results-btn primary" onClick={() => submitWrittenExam(true)}>
                Confirm and see results
              </button>
              <button className="results-btn" onClick={() => setShowWrittenSubmitWarning(false)}>
                Continue exam
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
  const canGoPrevious = examinerIndex > 0 || questionIndex > 0;

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

  const goPreviousQuestion = () => {
    if (!canGoPrevious) return;

    setShowAnswer(false);
    if (questionIndex > 0) {
      setQuestionIndex(index => index - 1);
      return;
    }

    const previousExaminer = session[examinerIndex - 1];
    setExaminerIndex(index => index - 1);
    setQuestionIndex(previousExaminer ? previousExaminer.followUps.length : 0);
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
        <button className="nav-btn" onClick={goPreviousQuestion} disabled={!canGoPrevious}>
          <Icons.ChevronLeft /> Προηγούμενη Ερώτηση
        </button>
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

function PinakakiaModule({ onBack, onHome }) {
  const [screen, setScreen] = useState("sources");
  const [sourceKey, setSourceKey] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const allBoxes = useMemo(() => ([
    ...getBoxesForSource("oxford").map(box => ({ ...box, sourceKey: "oxford" })),
    ...getBoxesForSource("crash").map(box => ({ ...box, sourceKey: "crash" })),
  ]), []);

  const searchResults = useMemo(() => {
    const normalized = normalizeGreekSearch(query);
    if (!normalized) return [];
    return allBoxes.filter(box => getBoxSearchText(box).includes(normalized)).slice(0, 40);
  }, [allBoxes, query]);

  const oxfordChapterGroups = useMemo(() => {
    const groups = new Map();
    getBoxesForSource("oxford").forEach(box => {
      const chapter = Number(box.chapter) || 0;
      if (!groups.has(chapter)) groups.set(chapter, []);
      groups.get(chapter).push(box);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  const sourceLabel = sourceKey === "crash" ? "Crash Course" : "Oxford";

  const openViewer = (nextSourceKey, boxes, index, options = {}) => {
    if (!boxes.length || index < 0) return;
    setSourceKey(nextSourceKey);
    setViewer({
      sourceKey: nextSourceKey,
      boxes,
      index,
      randomMode: Boolean(options.randomMode),
      history: options.history || (options.randomMode ? [index] : []),
      historyIndex: options.historyIndex ?? (options.randomMode ? 0 : -1),
      backScreen: options.backScreen || "sources",
      backChapter: options.backChapter ?? null,
    });
    setRevealed(false);
    setScreen("viewer");
  };

  const openRandom = (nextSourceKey, backScreen = null) => {
    const boxes = getBoxesForSource(nextSourceKey);
    const index = getRandomBoxIndex(boxes);
    openViewer(nextSourceKey, boxes, index, {
      randomMode: true,
      backScreen: backScreen || (nextSourceKey === "crash" ? "crash-modes" : "oxford-modes"),
    });
  };

  const handleBack = () => {
    if (screen === "sources") {
      onBack();
      return;
    }

    if (screen === "viewer" && viewer) {
      setScreen(viewer.backScreen || "sources");
      setSelectedChapter(viewer.backChapter ?? null);
      setRevealed(false);
      return;
    }

    if (screen === "oxford-modes" || screen === "crash-modes") {
      setScreen("sources");
      setSourceKey(null);
      return;
    }

    if (screen === "oxford-chapters") {
      setScreen("oxford-modes");
      return;
    }

    if (screen === "oxford-boxes") {
      setScreen("oxford-chapters");
      return;
    }

    if (screen === "crash-list") {
      setScreen("crash-modes");
      return;
    }

    setScreen("sources");
  };

  const openSearchResult = (box) => {
    const nextSourceKey = box.sourceKey || getBoxSourceKey(box);
    const boxes = getBoxesForSource(nextSourceKey);
    const index = boxes.findIndex(item => item.id === box.id);
    openViewer(nextSourceKey, boxes, index, { backScreen: screen, backChapter: selectedChapter });
  };

  const goViewerPrev = () => {
    if (!viewer) return;
    if (viewer.randomMode) {
      if (viewer.historyIndex <= 0) return;
      const nextHistoryIndex = viewer.historyIndex - 1;
      setViewer({ ...viewer, index: viewer.history[nextHistoryIndex], historyIndex: nextHistoryIndex });
      setRevealed(false);
      return;
    }
    if (viewer.index <= 0) return;
    setViewer({ ...viewer, index: viewer.index - 1 });
    setRevealed(false);
  };

  const goViewerRandom = () => {
    if (!viewer) return;
    const boxes = getBoxesForSource(viewer.sourceKey);
    const index = getRandomBoxIndex(boxes, viewer.index);
    const history = [...(viewer.history || []).slice(0, viewer.historyIndex + 1), index];
    setViewer({
      ...viewer,
      boxes,
      index,
      randomMode: true,
      history,
      historyIndex: history.length - 1,
    });
    setRevealed(false);
  };

  const goViewerNext = () => {
    if (!viewer) return;
    if (viewer.randomMode) {
      goViewerRandom();
      return;
    }
    if (viewer.index >= viewer.boxes.length - 1) return;
    setViewer({ ...viewer, index: viewer.index + 1 });
    setRevealed(false);
  };

  const renderShell = (children) => (
    <div className="pinakakia-screen fade-in">
      <div className="pinakakia-topbar">
        <button className="back-link" style={{ marginBottom: 0 }} onClick={handleBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
        <button className="home-btn" onClick={onHome}>
          <Icons.Home /> Αρχική
        </button>
      </div>
      <div className="pinakakia-search-wrap">
        <input
          className="pinakakia-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Αναζήτηση σε πινακάκια..."
        />
      </div>
      {normalizeGreekSearch(query) && (
        <div className="pinakakia-results" style={{ marginBottom: 28 }}>
          {searchResults.length ? searchResults.map(box => (
            <button key={`${box.sourceKey}-${box.id}`} className="pinakakia-row" onClick={() => openSearchResult(box)}>
              <span className="pinakakia-row-title">Box {box.boxNumber} — {box.title}</span>
              <span className="pinakakia-row-meta">
                <span>{box.source}</span>
                {box.chapter && <span>Κεφάλαιο {box.chapter}</span>}
                {box.page && <span>pg. {box.page}</span>}
              </span>
            </button>
          )) : (
            <div className="pinakakia-empty">Δεν βρέθηκαν αποτελέσματα.</div>
          )}
        </div>
      )}
      {children}
    </div>
  );

  if (screen === "sources") {
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Πινακάκια</h2>
        <div className="pinakakia-list">
          <button className="pinakakia-card" onClick={() => { setSourceKey("oxford"); setScreen("oxford-modes"); }}>
            Oxford <Icons.ChevronRight />
          </button>
          <button className="pinakakia-card" onClick={() => { setSourceKey("crash"); setScreen("crash-modes"); }}>
            Crash Course <Icons.ChevronRight />
          </button>
        </div>
      </>
    );
  }

  if (screen === "oxford-modes") {
    const boxes = getBoxesForSource("oxford");
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Oxford</h2>
        <div className="pinakakia-list">
          <button className="pinakakia-card" onClick={() => setScreen("oxford-chapters")}>
            Κεφάλαια <Icons.ChevronRight />
          </button>
          <button className="pinakakia-card" disabled={!boxes.length} onClick={() => openRandom("oxford", "oxford-modes")}>
            Τυχαία <Icons.ChevronRight />
          </button>
        </div>
        {!boxes.length && <div className="pinakakia-empty" style={{ marginTop: 16 }}>Δεν έχουν προστεθεί ακόμα πινακάκια Oxford.</div>}
      </>
    );
  }

  if (screen === "oxford-chapters") {
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Oxford — Κεφάλαια</h2>
        <div className="pinakakia-list">
          {oxfordChapterGroups.map(([chapter, boxes]) => (
            <button
              key={chapter}
              className="pinakakia-row"
              onClick={() => {
                setSelectedChapter(chapter);
                setScreen("oxford-boxes");
              }}
            >
              <span className="pinakakia-row-title">Κεφάλαιο {chapter} — {boxes.length} πινακάκια</span>
            </button>
          ))}
        </div>
        {!oxfordChapterGroups.length && <div className="pinakakia-empty">Δεν έχουν προστεθεί ακόμα κεφάλαια.</div>}
      </>
    );
  }

  if (screen === "oxford-boxes") {
    const boxes = getBoxesForSource("oxford").filter(box => Number(box.chapter) === Number(selectedChapter));
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Κεφάλαιο {selectedChapter}</h2>
        <div className="pinakakia-list">
          {boxes.map((box, index) => (
            <button
              key={box.id}
              className="pinakakia-row"
              onClick={() => openViewer("oxford", boxes, index, { backScreen: "oxford-boxes", backChapter: selectedChapter })}
            >
              <span className="pinakakia-row-title">Box {box.boxNumber} — {box.title}</span>
              <span className="pinakakia-row-meta">{box.page && <span>pg. {box.page}</span>}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (screen === "crash-modes") {
    const boxes = getBoxesForSource("crash");
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Crash Course</h2>
        <div className="pinakakia-list">
          <button className="pinakakia-card" onClick={() => setScreen("crash-list")}>
            Με σειρά <Icons.ChevronRight />
          </button>
          <button className="pinakakia-card" disabled={!boxes.length} onClick={() => openRandom("crash", "crash-modes")}>
            Τυχαία <Icons.ChevronRight />
          </button>
        </div>
        {!boxes.length && <div className="pinakakia-empty" style={{ marginTop: 16 }}>Δεν έχουν προστεθεί ακόμα πινακάκια Crash Course.</div>}
      </>
    );
  }

  if (screen === "crash-list") {
    const boxes = getBoxesForSource("crash");
    return renderShell(
      <>
        <h2 className="pinakakia-section-title">Crash Course — Με σειρά</h2>
        <div className="pinakakia-list">
          {boxes.map((box, index) => (
            <button
              key={box.id}
              className="pinakakia-row"
              onClick={() => openViewer("crash", boxes, index, { backScreen: "crash-list" })}
            >
              <span className="pinakakia-row-title">Box {box.boxNumber} — {box.title}</span>
              <span className="pinakakia-row-meta">{box.page && <span>pg. {box.page}</span>}</span>
            </button>
          ))}
        </div>
        {!boxes.length && <div className="pinakakia-empty">Δεν έχουν προστεθεί ακόμα πινακάκια.</div>}
      </>
    );
  }

  if (screen === "viewer" && viewer) {
    const box = viewer.boxes[viewer.index];
    const canGoPrev = viewer.randomMode ? viewer.historyIndex > 0 : viewer.index > 0;
    const canGoNext = viewer.randomMode || viewer.index < viewer.boxes.length - 1;
    const contentLines = getBoxContentLines(box.content);

    return renderShell(
      <div className="pinakakia-viewer">
        <div className="pinakakia-viewer-meta">
          <span>{box.source || sourceLabel}</span>
          <span>Box {box.boxNumber}</span>
          {box.chapter && <span>Κεφάλαιο {box.chapter}</span>}
          {box.page && <span>pg. {box.page}</span>}
        </div>
        <button className="pinakakia-reveal" onClick={() => setRevealed(value => !value)}>
          <div className={`pinakakia-book-box ${viewer.sourceKey}`}>
            <div className="pinakakia-book-header">
              <span>Box {box.boxNumber}</span>
              <span className="pinakakia-book-header-title">{box.title}</span>
              {box.page && <span className="pinakakia-book-header-page">pg. {box.page}</span>}
            </div>
            <div className="pinakakia-book-body">
              {revealed ? (
                <>
                  <div className="pinakakia-hide-note">Πάτησε για απόκρυψη</div>
                  <div className="pinakakia-content-text">
                    {contentLines.map((line, index) => {
                      const isHeading = isBoxHeadingLine(line);
                      return (
                        <div
                          className={`pinakakia-content-line ${isHeading ? "heading" : "item"}`}
                          key={`${box.id}-line-${index}`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="pinakakia-reveal-placeholder">Πάτησε για εμφάνιση</div>
              )}
            </div>
          </div>
        </button>
        <div className="pinakakia-viewer-nav">
          <button className="nav-btn" onClick={goViewerPrev} disabled={!canGoPrev}>
            <Icons.ChevronLeft /> Προηγούμενο
          </button>
          <button className="nav-btn primary" onClick={goViewerRandom}>
            Τυχαίο
          </button>
          <button className="nav-btn" onClick={goViewerNext} disabled={!canGoNext}>
            Επόμενο <Icons.ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  return renderShell(<div className="pinakakia-empty">Δεν υπάρχει διαθέσιμο περιεχόμενο.</div>);
}

function SosHome({ onBack, onHome, onOpenSection }) {
  const sections = [
    { id: "highyield", title: "Γρήγορα SOS" },
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

function SosHighYieldTables({ onBack, onHome }) {
  const [flippedIds, setFlippedIds] = useState(() => new Set());

  const toggleCard = (entryId) => {
    setFlippedIds(current => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

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
      <h2>Γρήγορα SOS</h2>
      <div className="sos-flip-list">
        {highYieldPsychiatryTables.map(entry => {
          const isFlipped = flippedIds.has(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              className={`sos-flip-card ${isFlipped ? "flipped" : ""}`}
              onClick={() => toggleCard(entry.id)}
            >
              <div className="sos-flip-text">
                {isFlipped ? entry.answer : entry.prompt}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SosNumbersList({ onBack, onHome }) {
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
      <div className="sos-number-list">
        {sosNumbers.map(entry => (
          <div key={entry.id} className="sos-number-entry">
            {renderSosNumberText(getSosNumberFact(entry))}
          </div>
        ))}
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
  const [selectedMcqTopic, setSelectedMcqTopic] = useState(null);
  const [oralViewerData, setOralViewerData] = useState(null);
  const [oralTableData, setOralTableData] = useState(null);
  const [showOpeningRequest, setShowOpeningRequest] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(DEFAULT_UPDATE_MESSAGE);
  const [updateMessageStatus, setUpdateMessageStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  const [profileStore, setProfileStore] = useState(() => loadProfileStore());
  const [syncStatus, setSyncStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  const remoteSaveTimerRef = useRef(null);
  const oralRemoteSaveTimerRef = useRef(null);
  const lastRemoteAttemptIdRef = useRef(null);
  const pendingMcqRemoteSaveRef = useRef(null);
  const activeProfile = profileStore.activeProfileId
    ? profileStore.profiles[profileStore.activeProfileId]
    : null;
  const mcqProgress = activeProfile?.mcqProgress || createEmptyMcqProgress();
  const oralProgress = activeProfile?.oralProgress || createEmptyOralProgress();
  const sosProgress = activeProfile?.sosProgress || createEmptySosProgress();
  const mcqProgressSummary = useMemo(() => summarizeMcqProgress(mcqProgress), [mcqProgress]);
  const oralProgressSummary = useMemo(() => summarizeOralProgress(oralProgress), [oralProgress]);
  const selectedMcqTopicQuestions = useMemo(
    () => selectedMcqTopic ? shuffleItems(getQuestionsForMcqTopic(selectedMcqTopic)) : [],
    [selectedMcqTopic]
  );
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
    if (!ONLINE_PROFILES_ENABLED) {
      setUpdateMessage(DEFAULT_UPDATE_MESSAGE);
      setUpdateMessageStatus("local");
      return;
    }

    let cancelled = false;

    async function loadUpdateMessage(silent = false) {
      if (!silent) setUpdateMessageStatus("loading");
      try {
        const message = await loadRemoteUpdateMessage();
        if (cancelled) return;
        setUpdateMessage(message);
        setUpdateMessageStatus("online");
      } catch {
        if (cancelled) return;
        setUpdateMessage(DEFAULT_UPDATE_MESSAGE);
        setUpdateMessageStatus("offline");
      }
    }

    loadUpdateMessage();
    const refreshUpdateMessage = () => loadUpdateMessage(true);
    const refreshTimer = window.setInterval(refreshUpdateMessage, 120000);
    window.addEventListener("focus", refreshUpdateMessage);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshUpdateMessage);
    };
  }, []);

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
        const writtenDraftViewedQuestionIds = Array.isArray(progress.writtenExamDraft?.viewedQuestionIds)
          ? progress.writtenExamDraft.viewedQuestionIds
          : [];
        if (writtenDraftViewedQuestionIds.length) {
          await saveRemoteQuestionStates(profileId, progress, writtenDraftViewedQuestionIds);
        }

        const latestAttempt = progress.attempts?.[0];
        const latestAttemptId = latestAttempt?.id;
        if (latestAttemptId && latestAttemptId !== lastRemoteAttemptIdRef.current) {
          await saveRemoteAnswerBehavior(profileId, progress, lastRemoteAttemptIdRef.current);

          if (latestAttempt.mode === "written" && latestAttempt.sessionId) {
            const writtenSession = (progress.writtenExamSessions || [])
              .find(session => session.id === latestAttempt.sessionId);
            if (writtenSession?.questionIds?.length) {
              await saveRemoteQuestionStates(profileId, progress, writtenSession.questionIds);
            }
          }

          lastRemoteAttemptIdRef.current = latestAttemptId;
        }
        setSyncStatus("online");
      } catch (error) {
        console.error("Remote MCQ progress save failed", error);
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
    setSelectedMcqTopic(null);
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
    setSelectedMcqTopic(null);
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

  const handleSaveUpdateMessage = useCallback(async (message) => {
    const nextMessage = String(message || "").trim() || DEFAULT_UPDATE_MESSAGE;
    if (!ONLINE_PROFILES_ENABLED) {
      setUpdateMessage(nextMessage);
      setUpdateMessageStatus("local");
      return nextMessage;
    }

    setUpdateMessageStatus("saving");
    try {
      const savedMessage = await saveRemoteUpdateMessage(nextMessage);
      setUpdateMessage(savedMessage);
      setUpdateMessageStatus("online");
      return savedMessage;
    } catch (error) {
      setUpdateMessageStatus("offline");
      throw error;
    }
  }, []);

  const updateMcqProgress = useCallback((nextOrUpdater) => {
    const profileId = profileStore.activeProfileId;
    if (!profileId) return;

    setProfileStore(prev => {
      const profile = prev.profiles[profileId];
      if (!profile) return prev;

      const currentProgress = profile.mcqProgress || createEmptyMcqProgress();
      const nextProgress = typeof nextOrUpdater === "function"
        ? nextOrUpdater(currentProgress)
        : nextOrUpdater;

      pendingMcqRemoteSaveRef.current = { profileId, progress: nextProgress };

      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profileId]: {
            ...profile,
            mcqProgress: nextProgress,
          },
        },
      };
    });
  }, [profileStore.activeProfileId]);

  useEffect(() => {
    const pending = pendingMcqRemoteSaveRef.current;
    if (!pending) return;

    pendingMcqRemoteSaveRef.current = null;
    queueRemoteProgressSave(pending.profileId, pending.progress);
  }, [profileStore, queueRemoteProgressSave]);

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
    setSelectedMcqTopic(null);
    setProfileStore(prev => ({ ...prev, activeProfileId: null }));
  }, []);

  const startMcqMode = useCallback((mode) => {
    if (mode !== "category") setSelectedMcqTopic(null);
    setTestMode(mode);
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
            updateMessage={updateMessage}
            updateMessageStatus={updateMessageStatus}
            onSaveUpdateMessage={handleSaveUpdateMessage}
          />
        )}
        {activeProfile && screen === 'pinakakia' && (
          <PinakakiaModule
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'mcq' && !testMode && (
          <McqSelect
            onBack={() => setScreen('home')}
            onStart={startMcqMode}
            onHome={() => setScreen('home')}
            progressSummary={mcqProgressSummary}
            writtenExamSessions={getWrittenExamSessions(mcqProgress)}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'category' && !selectedMcqTopic && (
          <McqTopicSelect
            onBack={() => {
              setSelectedMcqTopic(null);
              setTestMode(null);
            }}
            onHome={() => {
              setSelectedMcqTopic(null);
              setTestMode(null);
              setScreen('home');
            }}
            onSelectTopic={(topic) => setSelectedMcqTopic(topic)}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'vignettes' && (
          <McqVignetteMode
            progress={mcqProgress}
            onProgressChange={updateMcqProgress}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'matching' && (
          <McqMatchingMode
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'extra' && (
          <ExtraMcqMode
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode && !['vignettes', 'matching', 'extra'].includes(testMode) && (testMode !== 'category' || selectedMcqTopic) && (
          <McqTest
            mode={testMode}
            progress={mcqProgress}
            onProgressChange={updateMcqProgress}
            sessionQuestions={testMode === 'category' ? selectedMcqTopicQuestions : null}
            sessionTitle={testMode === 'category' ? selectedMcqTopic : null}
            onBack={() => {
              if (testMode === 'category') {
                setSelectedMcqTopic(null);
              } else {
                setTestMode(null);
              }
            }}
            onHome={() => {
              setSelectedMcqTopic(null);
              setTestMode(null);
              setScreen('home');
            }}
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
        {activeProfile && screen === 'sos-highyield' && (
          <SosHighYieldTables
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
        {activeProfile && screen === 'home' && showOpeningRequest && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Μικρό request">
            <div className="modal">
              <h3>Ένα μικρό request 🙂</h3>
              <p>
                Αν σας βοηθά η εφαρμογή, μοιραστείτε τη με συναδέλφους, αλλά ας μην τη φτάσει στα μάτια των εξεταστών.
                Θα ήταν κρίμα ένα εργαλείο που φτιάχτηκε για να βοηθήσει στην προετοιμασία να οδηγήσει τελικά σε αλλαγές στη διαδικασία των εξετάσεων.
              </p>
              <div className="modal-actions">
                <button className="results-btn primary" onClick={() => setShowOpeningRequest(false)}>
                  Το κατάλαβα
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
