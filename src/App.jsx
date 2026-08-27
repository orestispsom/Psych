import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { Icons } from "./components/Icons.jsx";
import AppShell from "./components/AppShell.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import ScaleStrip from "./components/ScaleStrip.jsx";
import ShortcutSheet from "./components/ShortcutSheet.jsx";
import SupportWidget from "./components/SupportWidget.jsx";
import { useTheme } from "./lib/useTheme.js";
import { loadStudyPosition, saveStudyPosition, clearStudyPosition } from "./lib/studyPosition.js";
import { useWindowKeydown } from "./lib/useWindowKeydown.js";

import oralData from "./data/oral.js";
import oralCoreQuestions from "./data/oralCore.js";
import oralPreviousQuestionSources from "./data/oralPreviousQuestionSources.js";
import {
  buildMcqQualitySignals,
  getMcqQualityPreference,
  rankQuestionsWithQuality,
  selectAdaptiveQuestionOrder,
  selectWrittenExamByTopic,
} from "./mcqSelection.mjs";
import {
  parseAppPath,
  pathForMcqMode,
  pathForScreen,
  pathForTableScreen,
} from "./appRoutes.js";

let QUESTIONS = [];
let questionBankPromise = null;
let sosStudyDataPromise = null;

function loadQuestionBank() {
  if (!questionBankPromise) {
    questionBankPromise = import("./data/questions.js")
      .then(module => {
        QUESTIONS = module.default;
        return QUESTIONS;
      })
      .catch(error => {
        questionBankPromise = null;
        throw error;
      });
  }

  return questionBankPromise;
}

function loadSosStudyData() {
  if (!sosStudyDataPromise) {
    sosStudyDataPromise = Promise.all([
      import("./data/sos.js"),
      import("./data/highYieldPsychiatryTables.js"),
    ])
      .then(([sosModule, highYieldModule]) => ({
        numbers: sosModule.sosNumbers,
        criticalTopics: sosModule.sosCriticalTopics,
        differentialDiagnosis: sosModule.sosDifferentialDiagnosis,
        highYieldTables: highYieldModule.highYieldPsychiatryTables,
      }))
      .catch(error => {
        sosStudyDataPromise = null;
        throw error;
      });
  }

  return sosStudyDataPromise;
}

// ═══════════════════════════════════════════════════════════════
// RANDOM QUESTION SELECTION
// ═══════════════════════════════════════════════════════════════

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

function getBoxesForSource(sourceKey, referenceSources) {
  const boxes = sourceKey === "crash"
    ? referenceSources?.crashCourseBoxes || []
    : referenceSources?.oxfordBoxes || [];
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
  const sourceKey = getBoxSourceKey(box);
  const contentText = getBoxContentLines(box.content, sourceKey).map(line => line.text).join(" ");
  return normalizeGreekSearch([
    box.source,
    box.chapter ? `chapter ${box.chapter} κεφάλαιο ${box.chapter}` : "",
    box.boxNumber ? `box ${box.boxNumber} ${box.boxNumber}` : "",
    box.page ? `page ${box.page} pg ${box.page} σελίδα ${box.page}` : "",
    box.title,
    contentText,
  ].join(" "));
}

function getBoxContentLines(content, sourceKey = "") {
  const lines = [];

  function processItems(items, indentLevel = 0) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (typeof item === "string") {
        const text = item.trim();
        if (text) {
          const kind = isBoxHeadingLine(text, sourceKey) ? "heading" : "item";
          lines.push({ text, kind, indentLevel });
        }
        continue;
      }
      if (item && typeof item === "object") {
        if (item.type === "section") {
          if (item.heading) {
            lines.push({ text: String(item.heading).trim(), kind: "heading", indentLevel });
          }
          if (Array.isArray(item.items)) {
            processItems(item.items, indentLevel + 1);
          }
        } else if (item.type === "subsection") {
          if (item.heading) {
            lines.push({ text: String(item.heading).trim(), kind: "subsection-heading", indentLevel });
          }
          if (Array.isArray(item.items)) {
            processItems(item.items, indentLevel + 1);
          }
        } else if (item.type === "text" && Array.isArray(item.lines)) {
          // legacy text block
          item.lines.forEach(line => {
            const text = String(line || "").trim();
            if (text) {
              const kind = isBoxHeadingLine(text, sourceKey) ? "heading" : "item";
              lines.push({ text, kind, indentLevel });
            }
          });
        } else {
          // fallback: try to get text
          const text = String(item.text || item.heading || item.title || "").trim();
          if (text) {
            const kind = isBoxHeadingLine(text, sourceKey) ? "heading" : "item";
            lines.push({ text, kind, indentLevel });
          }
        }
      }
    }
  }

  if (Array.isArray(content)) {
    processItems(content, 0);
  } else {
    const text = String(content || "").trim();
    if (text) {
      const explicitLines = text.split(/\r?\n+/).map(line => line.trim()).filter(Boolean);
      if (explicitLines.length > 1) {
        explicitLines.forEach(line => {
          const kind = isBoxHeadingLine(line, sourceKey) ? "heading" : "item";
          lines.push({ text: line, kind, indentLevel: 0 });
        });
      } else {
        lines.push({ text, kind: "item", indentLevel: 0 });
      }
    }
  }

  return lines;
}


function isBoxHeadingLine(line, sourceKey = "") {
  const value = String(line || "").trim();
  if (!value) return false;
  const oxfordHeadingPrefixes = [
    "According to ",
    "Features",
    "Symptoms",
    "Criteria",
    "Clinical features",
    "Risk factors",
    "Management",
    "Treatment",
    "Assessment",
    "Indications",
    "Contraindications",
    "Causes",
    "Aetiology",
    "Classification",
    "Diagnosis",
    "Differential diagnosis",
    "Complications",
    "Principles",
    "Advantages",
    "Disadvantages",
    "Examples",
    "Note",
  ];
  if (sourceKey === "oxford") {
    return (
      oxfordHeadingPrefixes.some(prefix => value === prefix || value.startsWith(prefix) || value.startsWith(`${prefix}:`) || value.startsWith(`${prefix} (`)) ||
      value === "Autoscopic hallucinations" ||
      value === "Autoscopic hallucinations:" ||
      value.endsWith(":") ||
      /^[A-Z]$/.test(value)
    );
  }

  return (
    value.startsWith("Κατά ") ||
    value.startsWith("According to ") ||
    value.endsWith(":") ||
    value === "Αυτοσκοπικές ψευδαισθήσεις" ||
    value === "Autoscopic hallucinations" ||
    /^[A-Z]$/.test(value)
  );
}

const MCQ_PROGRESS_STORAGE_KEY = "psychiatry-mcq-progress-v1";
const PROFILE_STORAGE_KEY = "psychiatry-study-profiles-v1";
const ADMIN_REMEMBER_STORAGE_KEY = "psychiatry-admin-remember-v1";
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const ONLINE_PROFILES_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SUPABASE_PROFILE_TABLE = "study_profiles";
const SUPABASE_APP_SETTINGS_TABLE = "app_settings";
const UPDATE_MESSAGE_SETTING_KEY = "home_update_message";
const DEFAULT_UPDATE_MESSAGE = "\u039c\u03bf\u03b9\u03c1\u03b1\u03c3\u03c4\u03b5\u03af\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b5\u03c6\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c5\u03c0\u03b5\u03cd\u03b8\u03b7\u03bd\u03b1.";
const SUPPORT_WIDGET_SETTING_KEY = "support_widget_enabled";
const SUPPORT_WIDGET_LOCAL_KEY = "psych_support_widget_enabled";
const SUPPORT_WIDGET_DELAY_SETTING_KEY = "support_widget_delay_min";
const SUPPORT_WIDGET_DELAY_LOCAL_KEY = "psych_support_widget_delay_min";
const SUPPORT_WIDGET_DEFAULT_DELAY_MIN = 30;
const ADMIN_PROFILE_ID = "orestis";
const ADMIN_PASSWORD_SALT = "psych-admin-gate-v1";
const ADMIN_PASSWORD_HASH = "6c257c22343abe14b00c4efcd7ce29b038157578ee4b18972efff8ff2b165ef1";
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
  "\u03a3\u03c9\u03bc\u03b1\u03c4\u03b9\u03ba\u03ac, \u03b4\u03b9\u03b1\u03c3\u03c7\u03b9\u03c3\u03c4\u03b9\u03ba\u03ac \u03ba\u03b1\u03b9 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03b9\u03ba\u03ac \u03c3\u03c5\u03bc\u03c0\u03c4\u03ce\u03bc\u03b1\u03c4\u03b1",
  "\u03a3\u03b5\u03be\u03bf\u03c5\u03b1\u03bb\u03b9\u03ba\u03cc\u03c4\u03b7\u03c4\u03b1, \u03c6\u03cd\u03bb\u03bf \u03ba\u03b1\u03b9 \u03c0\u03b5\u03c1\u03b9\u03b3\u03b5\u03bd\u03bd\u03b7\u03c4\u03b9\u03ba\u03ae \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
  "\u03a8\u03c5\u03c7\u03bf\u03b8\u03b5\u03c1\u03b1\u03c0\u03b5\u03af\u03b1",
  "\u039d\u03bf\u03bc\u03b9\u03ba\u03ac, \u03b4\u03b5\u03bf\u03bd\u03c4\u03bf\u03bb\u03bf\u03b3\u03af\u03b1 \u03ba\u03b1\u03b9 \u03b9\u03b1\u03c4\u03c1\u03bf\u03b4\u03b9\u03ba\u03b1\u03c3\u03c4\u03b9\u03ba\u03ae \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
  "\u0399\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae \u03ba\u03b1\u03b9 \u03b4\u03b9\u03b1\u03c3\u03c5\u03bd\u03b4\u03b5\u03c4\u03b9\u03ba\u03ae \u03c8\u03c5\u03c7\u03b9\u03b1\u03c4\u03c1\u03b9\u03ba\u03ae",
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
      high_yield: {},
      critical_topics: {},
      differential_diagnosis: {},
      numbers: {},
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
      high_yield: Object.fromEntries(
        Object.entries(mastered.high_yield || {}).filter(([, value]) => Boolean(value))
      ),
      critical_topics: Object.fromEntries(
        Object.entries(mastered.critical_topics || {}).filter(([, value]) => Boolean(value))
      ),
      differential_diagnosis: Object.fromEntries(
        Object.entries(mastered.differential_diagnosis || {}).filter(([, value]) => Boolean(value))
      ),
      numbers: Object.fromEntries(
        Object.entries(mastered.numbers || {}).filter(([, value]) => Boolean(value))
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

let crucialQuestionsPromise;
let crucialQuestionMapPromise;

function loadCrucialQuestions() {
  if (!crucialQuestionsPromise) {
    crucialQuestionsPromise = import("./data/crucialQuestionsContent.js")
      .then(module => module.default);
  }
  return crucialQuestionsPromise;
}

function loadCrucialQuestionMap() {
  if (!crucialQuestionMapPromise) {
    crucialQuestionMapPromise = loadCrucialQuestions()
      .then(questions => new Map(questions.map(question => [question.id, question])));
  }
  return crucialQuestionMapPromise;
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
    bookmarks: {},
    vignettes: { completed: {}, updatedAt: null },
    updatedAt: null,
  };
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
    bookmarks: progress.bookmarks && typeof progress.bookmarks === "object"
      ? Object.fromEntries(Object.entries(progress.bookmarks).filter(([, v]) => Boolean(v)))
      : {},
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

function isAdminProfile(profileOrId) {
  const profileId = typeof profileOrId === "string" ? profileOrId : profileOrId?.id;
  return profileId === ADMIN_PROFILE_ID;
}

async function verifyAdminPassword(password) {
  if (!globalThis.crypto?.subtle) return false;
  const value = new TextEncoder().encode(`${ADMIN_PASSWORD_SALT}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", value);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return hash === ADMIN_PASSWORD_HASH;
}

function loadRememberedAdminAccess() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_REMEMBER_STORAGE_KEY) === ADMIN_PROFILE_ID;
  } catch {
    return false;
  }
}

function saveRememberedAdminAccess(remembered) {
  if (typeof window === "undefined") return;
  try {
    if (remembered) {
      window.localStorage.setItem(ADMIN_REMEMBER_STORAGE_KEY, ADMIN_PROFILE_ID);
    } else {
      window.localStorage.removeItem(ADMIN_REMEMBER_STORAGE_KEY);
    }
  } catch {
    // Private browsing or storage policies may prevent device persistence.
  }
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
    themePreference: "light",
  };
}

function normalizeThemePreference(value) {
  return value === "dark" ? "dark" : "light";
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
            themePreference: normalizeThemePreference(profile.themePreference),
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
    themePreference: normalizeThemePreference(row.theme_preference),
  };
}

function profileToRemoteRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    mcq_progress: normalizeMcqProgress(profile.mcqProgress),
    oral_progress: normalizeOralProgress(profile.oralProgress),
    theme_preference: normalizeThemePreference(profile.themePreference),
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

// Admin-controlled visibility switches. Same key-value app_settings table as
// the update message; "1"/"0" strings so an absent row (never set) reads as
// enabled by default. When Supabase isn't configured the switch still works,
// but only for this device (localStorage) — there is no shared backend to
// broadcast it to other visitors, which the admin panel says explicitly.
async function loadRemoteSupportWidgetEnabled() {
  const rows = await supabaseTableRequest(SUPABASE_APP_SETTINGS_TABLE, {
    select: "key,value",
    key: `eq.${SUPPORT_WIDGET_SETTING_KEY}`,
    limit: "1",
  });
  const value = rows?.[0]?.value;
  return value !== "0";
}

async function saveRemoteSupportWidgetEnabled(enabled) {
  await supabaseTableRequest(
    SUPABASE_APP_SETTINGS_TABLE,
    { on_conflict: "key" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        key: SUPPORT_WIDGET_SETTING_KEY,
        value: enabled ? "1" : "0",
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return enabled;
}

function loadLocalSupportWidgetEnabled() {
  try {
    return window.localStorage.getItem(SUPPORT_WIDGET_LOCAL_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveLocalSupportWidgetEnabled(enabled) {
  try {
    window.localStorage.setItem(SUPPORT_WIDGET_LOCAL_KEY, enabled ? "1" : "0");
  } catch {
    /* best effort */
  }
}

async function loadRemoteSupportWidgetDelayMinutes() {
  const rows = await supabaseTableRequest(SUPABASE_APP_SETTINGS_TABLE, {
    select: "key,value",
    key: `eq.${SUPPORT_WIDGET_DELAY_SETTING_KEY}`,
    limit: "1",
  });
  const value = Number(rows?.[0]?.value);
  return Number.isFinite(value) && value > 0 ? value : SUPPORT_WIDGET_DEFAULT_DELAY_MIN;
}

async function saveRemoteSupportWidgetDelayMinutes(minutes) {
  await supabaseTableRequest(
    SUPABASE_APP_SETTINGS_TABLE,
    { on_conflict: "key" },
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        key: SUPPORT_WIDGET_DELAY_SETTING_KEY,
        value: String(minutes),
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return minutes;
}

function loadLocalSupportWidgetDelayMinutes() {
  try {
    const value = Number(window.localStorage.getItem(SUPPORT_WIDGET_DELAY_LOCAL_KEY));
    return Number.isFinite(value) && value > 0 ? value : SUPPORT_WIDGET_DEFAULT_DELAY_MIN;
  } catch {
    return SUPPORT_WIDGET_DEFAULT_DELAY_MIN;
  }
}

function saveLocalSupportWidgetDelayMinutes(minutes) {
  try {
    window.localStorage.setItem(SUPPORT_WIDGET_DELAY_LOCAL_KEY, String(minutes));
  } catch {
    /* best effort */
  }
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
    return "Δεν αποθηκεύτηκε το σχόλιο: ο συγχρονισμός δεν είναι ρυθμισμένος.";
  }

  if (/feedback_comment|schema cache|PGRST204|record .* has no field/i.test(detail)) {
    return "Δεν αποθηκεύτηκε το σχόλιο. Λείπει η στήλη feedback_comment.";
  }

  if (/relation .*mcq_feedback.* does not exist|Could not find the table|PGRST205|mcq_feedback/i.test(detail)) {
    return "Δεν αποθηκεύτηκε το σχόλιο. Λείπει ο πίνακας σχολίων.";
  }

  if (/row-level security|permission denied|42501|violates row-level security/i.test(detail)) {
    return "Δεν αποθηκεύτηκε το σχόλιο: δεν επιτρέπεται η εγγραφή.";
  }

  return "Δεν αποθηκεύτηκε το σχόλιο. Δοκίμασε ξανά.";
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
    high_yield: { ...progress.mastered.high_yield },
    critical_topics: { ...progress.mastered.critical_topics },
    differential_diagnosis: { ...progress.mastered.differential_diagnosis },
    numbers: { ...progress.mastered.numbers },
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
      select: "id,name,mcq_progress,oral_progress,theme_preference,created_at",
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
    delete fallbackRow.theme_preference;
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

function getQuestionRecord(records, questionId) {
  if (!records || typeof records !== "object") return {};
  return records[questionId] || records[String(questionId)] || records[Number(questionId)] || {};
}

function summarizeMcqProgress(progress) {
  const records = progress?.questions || {};
  const total = QUESTIONS.length;
  const seen = QUESTIONS.filter(q => hasSeenQuestion(getQuestionRecord(records, q.id))).length;
  const attempted = QUESTIONS.filter(q => getAttemptsCount(getQuestionRecord(records, q.id)) > 0).length;
  const mastered = QUESTIONS.filter(q => isQuestionMastered(getQuestionRecord(records, q.id))).length;
  const correct = QUESTIONS.reduce((sum, q) => sum + (getQuestionRecord(records, q.id)?.correctCount || 0), 0);
  const attempts = QUESTIONS.reduce((sum, q) => sum + getAttemptsCount(getQuestionRecord(records, q.id)), 0);

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
  return getQuestionRecord(progress?.questions, questionId);
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
  if (getAttemptsCount(record) > 0) return "Επανάληψη";
  if (hasSeenQuestion(record)) return "Προβλήθηκε";
  return "Νέα";
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

function selectDailyWrongQuestions(progress, count, usedIds, now = new Date(), qualitySignals = {}) {
  return selectUniqueQuestions(
    QUESTIONS
      .map(question => ({
        question,
        score:
          scoreQuestionForDailyWrongPriority(question, progress, now) +
          getMcqQualityPreference(question, qualitySignals),
        reason: "repeated_wrong",
      }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score),
    count,
    usedIds
  );
}

function selectDailyReviewQuestions(progress, count, usedIds, now = new Date(), qualitySignals = {}) {
  const records = progress.questions || {};
  const dueMastered = QUESTIONS
    .filter(question => isQuestionMastered(records[question.id]) && isDue(records[question.id], now))
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress, now) + getMcqQualityPreference(question, qualitySignals), reason: "mastered_due" }))
    .sort((a, b) => b.score - a.score);
  const dueReview = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForStudyPriority(question, progress, now) + getMcqQualityPreference(question, qualitySignals), reason: "normal_due" }))
    .filter(item => {
      const record = records[item.question.id];
      const mastery = getMasteryLevel(record);
      return hasSeenQuestion(record) && mastery > 0 && mastery < 5 && isDue(record, now);
    })
    .sort((a, b) => b.score - a.score);
  const weakReview = QUESTIONS
    .map(question => ({ question, score: scoreQuestionForWeakness(question, progress, now) + getMcqQualityPreference(question, qualitySignals), reason: "normal_due" }))
    .filter(item => isWeaknessCandidate(item.question, progress))
    .sort((a, b) => b.score - a.score);
  const novelty = rankQuestionsWithQuality(
    QUESTIONS.filter(question => !hasSeenQuestion(records[question.id])),
    () => 0,
    qualitySignals
  )
    .map(question => ({ question, reason: "unseen_or_random" }));
  const fallback = rankQuestionsWithQuality(
    QUESTIONS,
    question => scoreQuestionForStudyPriority(question, progress, now),
    qualitySignals,
    { jitter: 8 }
  )
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

function selectWeaknessQuestions(progress, count = WEAKNESS_SESSION_SIZE, qualitySignals = {}) {
  return rankQuestionsWithQuality(
    QUESTIONS.filter(question => isWeaknessCandidate(question, progress) && scoreQuestionForWeakness(question, progress) >= 25),
    question => scoreQuestionForWeakness(question, progress),
    qualitySignals,
    { jitter: 4 }
  ).slice(0, count);
}

function summarizeStoredMcqProgress(progress) {
  const records = Object.values(progress.questions || {});
  const attempted = records.filter(record => getAttemptsCount(record) > 0).length;
  const mastered = records.filter(record => isQuestionMastered(record)).length;

  return {
    mastered,
    review: Math.max(0, attempted - mastered),
  };
}

function getRecentSprintQuestionIds(progress, sessionCount = 20) {
  const sprintSessions = Array.isArray(progress?.sprintSessions) ? progress.sprintSessions : [];
  const sessionQuestionIds = sprintSessions
    .slice(0, sessionCount)
    .flatMap(session => Array.isArray(session.questionIds) ? session.questionIds : []);

  const recentSprintAttempts = (progress?.attempts || [])
    .filter(attempt => attempt?.mode === "sprint")
    .slice(0, sessionCount * SPRINT_SESSION_SIZE)
    .map(attempt => attempt.questionId);

  return new Set([...sessionQuestionIds, ...recentSprintAttempts].filter(Boolean).map(String));
}

function selectSprintQuestions(progress, count = SPRINT_SESSION_SIZE, qualitySignals = {}) {
  const records = progress.questions || {};
  const recentSprintIds = getRecentSprintQuestionIds(progress, 20);
  return selectAdaptiveQuestionOrder({
    questions: QUESTIONS,
    count,
    records,
    qualitySignals,
    isRecent: question => recentSprintIds.has(String(question.id)),
    hasSeen: hasSeenQuestion,
    getSeenCount,
    isMastered: isQuestionMastered,
    isDue,
    scoreStudy: question => scoreQuestionForStudyPriority(question, progress),
    scoreReview: question => scoreQuestionForRandomReview(question, progress),
  });
}

function selectRandomPracticeQuestions(progress, qualitySignals = {}, questions = QUESTIONS) {
  const now = new Date();
  const records = progress.questions || {};
  return selectAdaptiveQuestionOrder({
    questions,
    count: questions.length,
    records,
    qualitySignals,
    hasSeen: hasSeenQuestion,
    getSeenCount,
    isMastered: isQuestionMastered,
    isDue: record => isDue(record, now),
    scoreStudy: question => scoreQuestionForStudyPriority(question, progress, now),
    scoreReview: question => scoreQuestionForRandomReview(question, progress, now),
  });
}

function selectTopicPracticeQuestions(questions, progress, qualitySignals = {}) {
  return selectRandomPracticeQuestions(progress, qualitySignals, questions);
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

async function loadMcqQualitySignals() {
  if (!ONLINE_PROFILES_ENABLED) return {};

  const pageSize = 1000;
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await supabaseTableRequest("mcq_feedback", {
      select: "question_id,feedback_type,question_text_snapshot",
      feedback_type: "in.(quality_up,quality_down)",
      order: "created_at.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }

  return buildMcqQualitySignals(rows, QUESTIONS, getMcqStem);
}

function getRecentWrittenExamQuestionIds(progress, sessionCount = 2) {
  return new Set(
    getWrittenExamSessions(progress)
      .slice(0, sessionCount)
      .flatMap(session => Array.isArray(session.questionIds) ? session.questionIds : [])
      .map(String)
  );
}

function scoreQuestionForWrittenExam(question, progress, qualitySignals = {}, now = new Date()) {
  const record = getQuestionProgress(progress, question.id);
  const daysSinceAnswer = getDaysSince(record.lastAnsweredAt || record.seenAt, now);
  const latestWrittenAttempt = getLatestQuestionAttempt(progress, question.id, "written");
  const daysSinceWritten = getDaysSince(latestWrittenAttempt?.attemptedAt, now);
  let score = getMcqQualityPreference(question, qualitySignals, "written") + Math.random() * 8;

  // Day-based anti-recency penalty for any recent answer (smoothly decays over 14 days)
  if (daysSinceAnswer !== null && daysSinceAnswer < 14) {
    score -= Math.round(20 * (1 - daysSinceAnswer / 14));
  }

  // Day-based anti-recency penalty for previous written exam mocks (smoothly decays over 45 days)
  if (daysSinceWritten !== null && daysSinceWritten < 45) {
    score -= Math.round(120 * (1 - daysSinceWritten / 45));
  }

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

function selectWrittenExamQuestions(progress, count = WRITTEN_EXAM_SIZE, qualitySignals = {}) {
  const eligible = QUESTIONS.filter(question =>
    Array.isArray(question.options) &&
    question.options.length === 5 &&
    Number.isInteger(question.correct) &&
    question.correct >= 0 &&
    question.correct < question.options.length
  );
  const targetCount = Math.min(count, eligible.length);
  const now = new Date();
  const topicQuotas = buildWrittenTopicQuotas(eligible, targetCount);
  const selected = [];
  const usedIds = new Set();
  const usedSignatures = new Set();
  const recentWrittenIds = getRecentWrittenExamQuestionIds(progress, 2);

  const canUseQuestion = (question) => {
    if (!question || usedIds.has(question.id)) return false;
    const signature = getQuestionSignature(question);
    if (usedSignatures.has(signature)) return false;
    if (isNearDuplicateQuestion(question, selected)) return false;
    return true;
  };

  const pushQuestion = (question) => {
    if (!canUseQuestion(question)) return false;
    const signature = getQuestionSignature(question);
    usedIds.add(question.id);
    usedSignatures.add(signature);
    selected.push(question);
    return true;
  };

  return selectWrittenExamByTopic({
    eligible,
    targetCount,
    topicQuotas,
    getTopic: getQuestionTopic,
    scoreQuestion: question => scoreQuestionForWrittenExam(question, progress, qualitySignals, now),
    isRecent: question => recentWrittenIds.has(String(question.id)),
    trySelect: pushQuestion,
    getSelected: () => selected,
    shuffle: shuffleItems,
  });
}

function getDailyChallenge(progress, dateKey = getLocalDateKey()) {
  return progress.dailyChallenges?.[dateKey] || null;
}

function createDailyChallenge(progress, dateKey = getLocalDateKey(), qualitySignals = {}) {
  const existing = getDailyChallenge(progress, dateKey);
  if (existing?.questionIds?.length) return existing;

  const now = new Date();
  const usedIds = new Set();
  const wrongTarget = Math.min(DAILY_CHALLENGE_SIZE, Math.round(DAILY_CHALLENGE_SIZE * 0.8));
  const repeatedWrong = selectDailyWrongQuestions(progress, wrongTarget, usedIds, now, qualitySignals);
  const reviewTarget = DAILY_CHALLENGE_SIZE - repeatedWrong.length;
  const reviewQuestions = selectDailyReviewQuestions(progress, reviewTarget, usedIds, now, qualitySignals);
  const remaining = DAILY_CHALLENGE_SIZE - repeatedWrong.length - reviewQuestions.length;
  const fallback = remaining > 0
    ? selectUniqueQuestions(
        rankQuestionsWithQuality(
          QUESTIONS,
          question => scoreQuestionForStudyPriority(question, progress, now),
          qualitySignals,
          { jitter: 8 }
        ).map(question => ({ question, reason: "fallback_random" })),
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

function ensureDailyChallenge(progress, dateKey = getLocalDateKey(), qualitySignals = {}) {
  const challenge = createDailyChallenge(progress, dateKey, qualitySignals);

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

function selectBookmarkedQuestions(progress, allQuestions = QUESTIONS) {
  const bookmarks = progress?.bookmarks || {};
  return allQuestions.filter(question => Boolean(bookmarks[question.id] || bookmarks[String(question.id)]));
}

function getSessionQuestions(mode, progress, qualitySignals = {}) {
  if (mode === "bookmarks") {
    return selectBookmarkedQuestions(progress);
  }
  if (mode === "daily") {
    return createDailyChallenge(progress, getLocalDateKey(), qualitySignals).questionIds
      .map(id => QUESTIONS.find(question => question.id === id))
      .filter(Boolean);
  }
  if (mode === "sprint") return selectSprintQuestions(progress, SPRINT_SESSION_SIZE, qualitySignals);
  if (mode === "weakness") return selectWeaknessQuestions(progress, WEAKNESS_SESSION_SIZE, qualitySignals);
  if (mode === "written") return selectWrittenExamQuestions(progress, WRITTEN_EXAM_SIZE, qualitySignals);
  return selectRandomPracticeQuestions(progress, qualitySignals);
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
    repeated_wrong: "Επανειλημμένα λάθος",
    mastered_due: "Mastered · επανάληψη",
    normal_due: "Ώρα για επανάληψη",
    unseen_or_random: "Νέα ερώτηση",
    fallback_random: "Μεικτή επανάληψη",
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
  if (scorePercent >= 90) return { label: "Έτοιμος/η για εξετάσεις", className: "excellent" };
  if (scorePercent > 70) return { label: "Καλή επίδοση", className: "good" };
  if (scorePercent >= 50) return { label: "Οριακά επιτυχής", className: "pass" };
  return { label: "Όχι ακόμη σε επίπεδο επιτυχίας", className: "fail" };
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

// Icons live in ./components/Icons.jsx

/** Greek takes the singular at 1: «1 λάθος», never «1 λάθη». */
function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

// Screen and mode names, shared by the shell, the resume block and the titles.
const SCREEN_TITLES = {
  home: "Επανάληψη Ψυχιατρικής",
  admin: "Επιλογές διαχειριστή",
  mcq: "Πολλαπλής Επιλογής",
  oral: "Προφορικά",
  "oral-past": "Σημαντικά Θέματα",
  "oral-viewer": "Σημαντικά Θέματα",
  "oral-table": "Πίνακας Θεμάτων",
  "oral-crucial-index": "Κρίσιμες Ερωτήσεις",
  "oral-crucial-viewer": "Κρίσιμες Ερωτήσεις",
  "oral-simulator": "Προφορική Εξέταση",
  sos: "SOS Ψυχιατρικής",
  "sos-numbers": "Αριθμοί",
  "sos-highyield": "Γρήγορα SOS",
  "sos-critical": "Κρίσιμα Θέματα",
  "sos-differential": "Διαφοροδιάγνωση",
  pinakakia: "Πινακάκια",
};

const MCQ_MODE_LABELS = {
  sprint: "Mini-test",
  random: "Τυχαία Θέματα",
  daily: "Αδύναμα Θέματα",
  weakness: "Αδυναμίες",
  category: "Ερωτήσεις ανά Κατηγορία",
  written: "Προσομοίωση 100 Πολλαπλής",
  vignettes: "Vignettes",
  matching: "Αντιστοίχηση",
  DSM5: "DSM-5-TR",
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ProfileScreen({ profileStore, syncStatus, syncMessage, rememberedAdminAccess, onSelectProfile, onCreateProfile }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAdminProfile, setPendingAdminProfile] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const profiles = Object.values(profileStore.profiles)
    .sort((a, b) => a.name.localeCompare(b.name));

  const requestProfileSelection = (profile) => {
    if (!isAdminProfile(profile)) {
      onSelectProfile(profile.id);
      return;
    }

    if (rememberedAdminAccess) {
      onSelectProfile(profile.id, "", { useRememberedAccess: true });
      return;
    }

    setPendingAdminProfile(profile);
    setAdminPassword("");
    setAdminError("");
  };

  const closeAdminUnlock = () => {
    if (isVerifyingAdmin) return;
    setPendingAdminProfile(null);
    setAdminPassword("");
    setAdminError("");
  };

  const handleAdminUnlock = async (event) => {
    event.preventDefault();
    if (!pendingAdminProfile || !adminPassword) return;

    setIsVerifyingAdmin(true);
    setAdminError("");
    try {
      await onSelectProfile(pendingAdminProfile.id, adminPassword);
      setPendingAdminProfile(null);
      setAdminPassword("");
    } catch (err) {
      setAdminError(err.message || "Δεν ήταν δυνατό το ξεκλείδωμα αυτού του προφίλ.");
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const appendAdminDigit = (digit) => {
    setAdminPassword(value => `${value}${digit}`.slice(0, 12));
    setAdminError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = normalizeProfileName(username);

    if (name.length < 2) {
      setError("Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες.");
      return;
    }

    if (name.length > 32) {
      setError("Το όνομα πρέπει να έχει έως 32 χαρακτήρες.");
      return;
    }

    if (getProfileId(name) === ADMIN_PROFILE_ID) {
      const adminProfile = profileStore.profiles[ADMIN_PROFILE_ID];
      if (adminProfile) {
        setUsername("");
        requestProfileSelection(adminProfile);
      } else {
        setError("Το προφίλ διαχειριστή φορτώνει ακόμη. Δοκίμασε ξανά σε λίγο.");
      }
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await onCreateProfile(name);
      setUsername("");
    } catch (err) {
      setError(err.message || "Δεν ήταν δυνατή η δημιουργία αυτού του προφίλ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="profile-screen">
        <div className="profile-panel">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Ψυχιατρική</span>
          <h1>Επανάληψη Ψυχιατρικής</h1>
        </div>
        <p>Διάλεξε ή δημιούργησε προφίλ μελέτης. Η πρόοδός σου κρατιέται ανά προφίλ.</p>
        <div className={`sync-status ${syncStatus}`} role="status">
          {syncMessage}
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="profile-username">Όνομα προφίλ</label>
          <input
            id="profile-username"
            name="profile-username"
            className="profile-input"
            value={username}
            onChange={event => {
              setUsername(event.target.value);
              setError("");
            }}
            placeholder="Όνομα προφίλ"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button className="results-btn primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Αποθήκευση…" : "Συνέχεια"}
          </button>
        </form>
        {error && <div className="profile-error" role="alert">{error}</div>}

        {profiles.length > 0 && (
          <div className="profile-list">
            <div className="profile-list-title">Υπάρχοντα προφίλ</div>
            {profiles.map(profile => {
              const summary = summarizeStoredMcqProgress(profile.mcqProgress || createEmptyMcqProgress());
              const oralSummary = summarizeOralProgress(profile.oralProgress || createEmptyOralProgress());
              return (
                <button
                  key={profile.id}
                  className="profile-btn"
                  onClick={() => requestProfileSelection(profile)}
                >
                  <span className="item-body">
                    <span className="profile-name-row">
                      <span style={{ fontWeight: 600 }}>{profile.name}</span>
                      {isAdminProfile(profile) && <span className="admin-badge">admin</span>}
                    </span>
                    <span className="item-meta">
                      <span>{summary.mastered} mastered</span>
                      <span>{summary.review} για επανάληψη</span>
                      <span>Προφορικά {oralSummary.mastered}/{oralSummary.total}</span>
                    </span>
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--ink-3)", display: "flex" }} aria-hidden="true">
                    <Icons.ChevronRight />
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {pendingAdminProfile && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Επαλήθευση προφίλ διαχειριστή" onKeyDown={event => { if (event.key === "Escape") closeAdminUnlock(); }}>
          <form className="modal admin-unlock-modal" onSubmit={handleAdminUnlock}>
            <h3>Προφίλ διαχειριστή</h3>
            <p>Δώσε τον κωδικό για να ανοίξεις το προφίλ «{pendingAdminProfile.name}».</p>
            <input
              className="admin-pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              aria-label="Κωδικός διαχειριστή"
              value={adminPassword}
              onChange={event => {
                setAdminPassword(event.target.value.replace(/\D/g, "").slice(0, 12));
                setAdminError("");
              }}
              autoFocus
            />
            <div className="admin-pin-pad" aria-label="Αριθμητικό πληκτρολόγιο">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                <button className="admin-pin-key" type="button" key={digit} onClick={() => appendAdminDigit(digit)}>
                  {digit}
                </button>
              ))}
              <button className="admin-pin-key utility" type="button" onClick={() => { setAdminPassword(""); setAdminError(""); }}>
                Clear
              </button>
              <button className="admin-pin-key" type="button" onClick={() => appendAdminDigit(0)}>0</button>
              <button className="admin-pin-key utility" type="button" aria-label="Διαγραφή ψηφίου" onClick={() => { setAdminPassword(value => value.slice(0, -1)); setAdminError(""); }}>
                Delete
              </button>
            </div>
            {adminError && <div className="admin-pin-error" role="alert">{adminError}</div>}
            <div className="modal-actions">
              <button className="results-btn" type="button" onClick={closeAdminUnlock} disabled={isVerifyingAdmin}>Ακύρωση</button>
              <button className="results-btn primary" type="submit" disabled={!adminPassword || isVerifyingAdmin}>
                {isVerifyingAdmin ? "Checking..." : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function SectionRow({ id, icon, title, detail, level, onOpen }) {
  return (
    <button type="button" className="item item-section" onClick={() => onOpen(id)}>
      <span className="item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="item-body">
        <span className="item-title" style={{ fontWeight: 600 }}>{title}</span>
        {detail && <span className="item-meta"><span>{detail}</span></span>}
      </span>
      <span className="item-side">
        {typeof level === "number" ? <ScaleStrip level={level} label="Πρόοδος ενότητας" /> : null}
        <span style={{ color: "var(--ink-3)", display: "flex" }} aria-hidden="true">
          <Icons.ChevronRight />
        </span>
      </span>
    </button>
  );
}

// The four functions the whole app is organised around, so the home hub
// gets one deliberate exception to the "no cards" rule: this is the single
// dispatch point, not a list of study items.
const HOME_MODULE_ACCENT = { mcq: "mcq", oral: "oral", sos: "sos", pinakakia: "boxes" };

function HomeModuleCard({ id, icon, title, detail, onOpen }) {
  return (
    <button
      type="button"
      className={`home-module home-module-${HOME_MODULE_ACCENT[id]}`}
      onClick={() => onOpen(id)}
    >
      <span className="home-module-icon" aria-hidden="true">{icon}</span>
      <span className="home-module-title">{title}</span>
      {detail && <span className="home-module-detail">{detail}</span>}
      <span className="home-module-chevron" aria-hidden="true">
        <Icons.ChevronRight />
      </span>
    </button>
  );
}

function HomeScreen({ onNavigate, profileName, isAdmin, rememberAdmin, onToggleRememberAdmin, onSwitchProfile, updateMessage, updateMessageStatus, onSaveUpdateMessage, mcqProgressSummary, oralProgressSummary, resumePosition, onResume, onDismissResume, onOpenSearch }) {
  const [updateClickCount, setUpdateClickCount] = useState(0);
  const [isUpdateEditorOpen, setIsUpdateEditorOpen] = useState(false);
  const [updateDraft, setUpdateDraft] = useState(updateMessage || DEFAULT_UPDATE_MESSAGE);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [updateEditorStatus, setUpdateEditorStatus] = useState(null);
  const sections = [
    {
      id: 'mcq',
      icon: <Icons.ClipboardCheck />,
      title: 'Πολλαπλής Επιλογής',
    },
    {
      id: 'oral',
      icon: <Icons.Mic />,
      title: 'Προφορικά',
    },
    {
      id: 'sos',
      icon: <Icons.Bolt />,
      title: 'SOS',
    },
    {
      id: 'pinakakia',
      icon: <Icons.Table />,
      title: 'Πινακάκια',
    },
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
      setUpdateEditorStatus('Αποθηκεύτηκε.');
      setIsUpdateEditorOpen(false);
    } catch {
      setUpdateEditorStatus('Δεν αποθηκεύτηκε το μήνυμα.');
    } finally {
      setIsSavingUpdate(false);
    }
  };

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">Επανάληψη Ψυχιατρικής</h1>
      </div>

      <div>
        <button className="home-update-note" type="button" onClick={handleUpdateNoteClick}>
          <span className="bar-label">Update</span>
          <span className="bar-tagline">{updateMessage || DEFAULT_UPDATE_MESSAGE}</span>
        </button>
        {updateMessageStatus === 'offline' && (
          <div className="home-update-status">Εμφανίζεται το τοπικό μήνυμα ενημέρωσης.</div>
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
              <button className="btn btn-primary btn-sm" type="submit" disabled={isSavingUpdate}>
                {isSavingUpdate ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => setIsUpdateEditorOpen(false)}>
                Άκυρο
              </button>
            </div>
            {updateEditorStatus && <div className="home-update-status">{updateEditorStatus}</div>}
          </form>
        )}
      </div>

      <div className="figures">
        <div className="figure figure-due">
          <span className="figure-value">{mcqProgressSummary.review}</span>
          <span className="figure-label">Για επανάληψη</span>
        </div>
        <div className="figure figure-pass">
          <span className="figure-value">{mcqProgressSummary.mastered}</span>
          <span className="figure-label">Mastered</span>
        </div>
        <div className="figure">
          <span className="figure-value">{mcqProgressSummary.unseen}</span>
          <span className="figure-label">Νέες</span>
        </div>
        <div className="figure">
          <span className="figure-value">{mcqProgressSummary.accuracy}%</span>
          <span className="figure-label">Ευστοχία</span>
        </div>
      </div>

      <div className="home-modules-section">
        <div className="subscale">
          <h2 className="subscale-title">Ενότητες</h2>
          <span className="subscale-rule" />
          {resumePosition ? (
            <span className="home-resume-inline">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onResume}
                title={resumePosition.title}
              >
                Συνέχεια <Icons.ArrowRight />
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-icon"
                onClick={onDismissResume}
                aria-label="Καθαρισμός σημείου μελέτης"
              >
                <Icons.X />
              </button>
            </span>
          ) : <span />}
        </div>
        <div className="home-modules">
          {sections.map(section => (
            <HomeModuleCard key={section.id} {...section} onOpen={onNavigate} />
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="profile-bar">
          <span className="admin-badge">admin</span>
          <button
            className="btn btn-quiet"
            type="button"
            aria-pressed={rememberAdmin}
            title="Η επιλογή αποθηκεύεται μόνο σε αυτόν τον browser. Μην την ενεργοποιείς σε κοινόχρηστη συσκευή."
            onClick={() => onToggleRememberAdmin(!rememberAdmin)}
          >
            {rememberAdmin ? "Απομνημόνευση ενεργή" : "Να με θυμάται"}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminOptionsScreen({
  onBack,
  supportWidgetEnabled,
  onToggleSupportWidget,
  supportWidgetDelayMinutes,
  onChangeSupportWidgetDelay,
  supportWidgetSyncNote,
}) {
  return (
    <div className="admin-options">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Αρχική
        </button>
      </div>

      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Διαχείριση</span>
          <h2>Επιλογές διαχειριστή</h2>
        </div>
      </div>

      <div className="subscale">
        <h3 className="subscale-title">Buy Me a Coffee</h3>
        <span className="subscale-rule" />
        <span />
      </div>
      <button
        type="button"
        className="admin-toggle-row"
        onClick={onToggleSupportWidget}
        aria-pressed={supportWidgetEnabled}
      >
        <span>Εμφάνιση του widget</span>
        <span className={`admin-toggle-state ${supportWidgetEnabled ? "on" : "off"}`}>
          {supportWidgetEnabled ? "Ενεργό" : "Ανενεργό"}
        </span>
      </button>
      <label className="admin-delay-row">
        <span>Εμφάνιση μετά από</span>
        <span className="admin-delay-input">
          <input
            type="number"
            min={1}
            max={180}
            step={5}
            value={supportWidgetDelayMinutes ?? 30}
            onChange={event => onChangeSupportWidgetDelay(Number(event.target.value))}
          />
          <span>λεπτά</span>
        </span>
      </label>
      {supportWidgetSyncNote && <span className="admin-toggle-note">{supportWidgetSyncNote}</span>}
    </div>
  );
}

function McqSelect({ onBack, onStart, onHome, progressSummary, writtenExamSessions }) {
  const recentWrittenExamSessions = writtenExamSessions;

  const modes = [
    { id: 'sprint', icon: <Icons.Bolt />, title: 'Mini-test' },
    { id: 'random', icon: <Icons.Search />, title: 'Τυχαία Θέματα' },
    { id: 'category', icon: <Icons.BookOpen />, title: 'Ερωτήσεις ανά Κατηγορία' },
    { id: 'written', icon: <Icons.ClipboardCheck />, title: 'Προσομοίωση' },
    { id: 'bookmarks', icon: <Icons.Bookmark filled />, title: 'Σημειωμένες' },
    { id: 'vignettes', icon: <Icons.FileText />, title: 'Vignettes' },
    { id: 'matching', icon: <Icons.Check />, title: 'Αντιστοίχηση' },
    { id: 'weakness', icon: <Icons.ThumbsDown />, title: 'Αδύναμα Θέματα' },
  ];

  const renderModes = () => (
    <div className="mode-tile-grid">
      {modes.map(mode => (
        <button
          key={mode.id}
          className="mode-tile"
          onClick={() => onStart(mode.id)}
        >
          <span className="mode-tile-icon hub-row-icon" aria-hidden="true">{mode.icon}</span>
          <span className="mode-tile-body">
            <span className="mode-tile-title">{mode.title}</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mcq-select mcq-hub">
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Ενότητα</span>
          <h2>Πολλαπλής Επιλογής</h2>
          <span className="sheet-sub">{plural(progressSummary.total, "ερώτηση", "ερωτήσεις")} σε 21 κατηγορίες</span>
        </div>
      </div>

      <div className="mcq-memory">
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value" style={{ color: 'var(--pass)' }}>{progressSummary.mastered}</span>
          <span className="mcq-memory-label">Mastered</span>
        </div>
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value" style={{ color: 'var(--due)' }}>{progressSummary.review}</span>
          <span className="mcq-memory-label">Επανάληψη</span>
        </div>
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value">{progressSummary.unseen}</span>
          <span className="mcq-memory-label">Νέες</span>
        </div>
        <div className="mcq-memory-stat">
          <span className="mcq-memory-value">{progressSummary.accuracy}%</span>
          <span className="mcq-memory-label">Ευστοχία</span>
        </div>
      </div>

      {renderModes()}

      {recentWrittenExamSessions.length > 0 && (
        <div className="written-history">
          <div className="subscale">
            <h3 className="subscale-title">Προηγούμενες προσομοιώσεις</h3>
            <span className="subscale-rule" />
            <span className="subscale-total">{recentWrittenExamSessions.length}</span>
          </div>
          <div className="written-history-grid">
            {recentWrittenExamSessions.map(session => {
              const gradeClass = getPercentageColorClass(session.scorePercent);
              return (
                <div className="written-history-row" key={session.id}>
                  <span className="written-history-date">
                    {new Date(session.completedAt).toLocaleDateString("el-GR")}
                  </span>
                  <strong className={`written-history-score ${gradeClass}`}>
                    {session.correct}/{session.total}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function McqTopicSelect({ onBack, onHome, onSelectTopic, progress }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortFilter, setSortFilter] = useState("all"); // "all", "needWork", "most", "alpha"

  const topicCounts = useMemo(() => getMcqTopicCounts(), []);

  const topicMastery = useMemo(() => {
    const records = progress?.questions || {};
    const map = new Map();
    for (const question of QUESTIONS) {
      const topic = getQuestionTopic(question);
      const current = map.get(topic) || { mastered: 0, total: 0 };
      current.total += 1;
      if (isQuestionMastered(records[question.id])) current.mastered += 1;
      map.set(topic, current);
    }
    return map;
  }, [progress]);

  const filteredAndSortedTopics = useMemo(() => {
    let list = [...MCQ_TOPIC_CATEGORIES];
    const query = normalizeGreekSearch(searchQuery);

    if (query) {
      list = list.filter(topic => normalizeGreekSearch(topic).includes(query));
    }

    if (sortFilter === "needWork") {
      list.sort((a, b) => {
        const masteryA = topicMastery.get(a) || { mastered: 0, total: 1 };
        const masteryB = topicMastery.get(b) || { mastered: 0, total: 1 };
        const percentA = masteryA.total ? masteryA.mastered / masteryA.total : 0;
        const percentB = masteryB.total ? masteryB.mastered / masteryB.total : 0;
        return percentA - percentB;
      });
    } else if (sortFilter === "most") {
      list.sort((a, b) => (topicCounts.get(b) || 0) - (topicCounts.get(a) || 0));
    } else if (sortFilter === "alpha") {
      list.sort((a, b) => a.localeCompare(b, "el"));
    }

    return list;
  }, [searchQuery, sortFilter, topicMastery, topicCounts]);

  return (
    <div className="mcq-select">
      <div className="nav-bar" style={{ marginBottom: "var(--s4)" }}>
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Μενού MCQ
        </button>
      </div>

      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Πολλαπλής Επιλογής</span>
          <h2 aria-hidden="true">Ερωτήσεις ανά Κατηγορία</h2>
          <span className="sheet-sub">{MCQ_TOPIC_CATEGORIES.length} κατηγορίες</span>
        </div>
      </div>

      <div className="category-search-bar">
        <input
          type="search"
          className="category-search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Αναζήτηση σε 21 κατηγορίες…"
          aria-label="Αναζήτηση κατηγορίας"
        />
      </div>

      <div className="category-sort-bar">
        <button
          type="button"
          className={`review-filter-pill ${sortFilter === "all" ? "active" : ""}`}
          onClick={() => setSortFilter("all")}
        >
          Όλες
        </button>
        <button
          type="button"
          className={`review-filter-pill ${sortFilter === "needWork" ? "active" : ""}`}
          onClick={() => setSortFilter("needWork")}
        >
          🎯 Χρειάζονται Μελέτη
        </button>
        <button
          type="button"
          className={`review-filter-pill ${sortFilter === "most" ? "active" : ""}`}
          onClick={() => setSortFilter("most")}
        >
          📚 Περισσότερες Ερωτήσεις
        </button>
        <button
          type="button"
          className={`review-filter-pill ${sortFilter === "alpha" ? "active" : ""}`}
          onClick={() => setSortFilter("alpha")}
        >
          🔤 Α–Ω
        </button>
      </div>

      {filteredAndSortedTopics.length === 0 ? (
        <div className="explanation-box" style={{ marginTop: "var(--s3)" }}>
          <strong>Δεν βρέθηκε κατηγορία</strong>
          Δεν υπάρχει κατηγορία που να ταιριάζει με την αναζήτηση «{searchQuery}».
        </div>
      ) : (
        <div className="items items-plain">
          {filteredAndSortedTopics.map(topic => {
            const count = topicCounts.get(topic) || 0;
            const mastery = topicMastery.get(topic) || { mastered: 0, total: 0 };
            const percent = mastery.total ? Math.round((mastery.mastered / mastery.total) * 100) : 0;
            const level = mastery.total ? Math.round((mastery.mastered / mastery.total) * 5) : 0;

            return (
              <button
                key={topic}
                className="item"
                disabled={!count}
                onClick={() => onSelectTopic(topic)}
              >
                <span className="item-body">
                  <span className="item-title">{topic}</span>
                  <span className="item-meta">
                    <span>{plural(count, "ερώτηση", "ερωτήσεις")}</span>
                    <span>{mastery.mastered}/{count} mastered ({percent}%)</span>
                  </span>
                </span>
                <span className="item-side">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <ScaleStrip level={level} label={`Πρόοδος: ${topic}`} />
                    <div className="category-progress-track">
                      <div className="category-progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span style={{ color: "var(--ink-3)", display: "flex", marginLeft: 8 }} aria-hidden="true">
                    <Icons.ChevronRight />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
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

function getAvailableMatchingSets(matchingSets = []) {
  return matchingSets.filter(set => set?.items?.length && set?.choices?.length);
}

function pickRandomMatchingSet(matchingSets, excludeId = null) {
  const sets = getAvailableMatchingSets(matchingSets);
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

function getDSM5ChapterQuestions(chapter) {
  if (!chapter) return [];
  return (chapter.questions || []).map(question => ({
    ...question,
    sourceId: question.sourceId ?? question.id,
    id: `${chapter.id}_q${question.id}`,
    chapter: question.chapter ?? chapter.chapter,
    chapterTitle: question.chapterTitle || chapter.title,
  }));
}

function normalizeDSM5CorrectIndex(question) {
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

function isShortcutIgnoredTarget(target) {
  return target instanceof HTMLElement && (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function isSubmitOrAdvanceKey(event) {
  return event.key === "Enter" || event.code === "Space";
}

function buildDSM5Session(sourceType, chapter = null, dsm5trSelfExamQuestions = []) {
  const sourceQuestions = sourceType === "random"
    ? dsm5trSelfExamQuestions
    : getDSM5ChapterQuestions(chapter);

  const eligibleQuestions = sourceQuestions.filter(question => question?.options?.length);
  return sourceType === "random" ? shuffleItems(eligibleQuestions) : eligibleQuestions;
}

function DSM5McqMode({ onBack, onHome, chapters: dsm5trSelfExamChapters, questionBank: dsm5trSelfExamQuestions }) {
  const totalDSM5Questions = dsm5trSelfExamQuestions.length;
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
    const correct = answered && chosen === normalizeDSM5CorrectIndex(item);
    return { question: item, selected: chosen, answered, correct };
  });
  const answeredCount = answeredRows.filter(row => row.answered).length;
  const correctCount = answeredRows.filter(row => row.correct).length;
  const wrongRows = answeredRows.filter(row => row.answered && !row.correct);

  const startSession = (sourceType, chapter = null) => {
    const nextQuestions = buildDSM5Session(sourceType, chapter, dsm5trSelfExamQuestions);
    setSessionLabel(sourceType === "random" ? "Random" : `Chapter ${chapter.chapter}: ${chapter.title}`);
    setQuestions(nextQuestions);
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setResult(null);
    setReviewWrong(false);
  };

  const backToDSM5Home = () => {
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
        const correct = chosen === normalizeDSM5CorrectIndex(item);
        return { question: item, selected: chosen, answered: true, correct };
      });
      const correct = rows.filter(row => row.correct).length;
      setResult({ rows, total: rows.length, correct, wrong: rows.length - correct });
    }
  };

  const selectAnswer = (optionIndex) => {
    if (!question || isLocked) return;
    setAnswers(prev => ({ ...prev, [question.id]: optionIndex }));
  };

  useWindowKeydown(event => {
    if (event.ctrlKey || event.metaKey || event.altKey || isShortcutIgnoredTarget(event.target)) return;
    if (result || reviewWrong || !question) return;

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isLocked) {
      const order = getStoredOptionOrder(question, optionOrders);
      if (!order.length) return;
      event.preventDefault();
      const selectedPosition = order.indexOf(selected);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const nextPosition = selectedPosition < 0
        ? (step > 0 ? 0 : order.length - 1)
        : (selectedPosition + step + order.length) % order.length;
      selectAnswer(order[nextPosition]);
      return;
    }

    if (isSubmitOrAdvanceKey(event)) {
      event.preventDefault();
      if (event.repeat) return;
      if (!isLocked && selected !== undefined) {
        lockAnswer();
      } else if (isLocked && currentIdx < questions.length - 1) {
        setCurrentIdx(index => index + 1);
      }
    }
  });

  const renderQuestion = (
    rowQuestion = question,
    rowSelected = selected,
    lockedView = isLocked,
    progressLabel = questions.length > 0 ? `${currentIdx + 1}/${questions.length}` : null
  ) => {
    if (!rowQuestion) return null;
    const correctIndex = normalizeDSM5CorrectIndex(rowQuestion);
    const displayedOptions = getStoredOptionOrder(rowQuestion, optionOrders).map(originalIndex => ({
      originalIndex,
      text: rowQuestion.options[originalIndex],
    }));

    return (
      <div className="structured-card DSM5-question-card">
        <div className="structured-top">
          <span className="structured-progress">{rowQuestion.chapterTitle || "DSM5 Self-Exam"}</span>
          {progressLabel && <span className="structured-progress">{progressLabel}</span>}
        </div>
        <div className="structured-question DSM5-question-stem">{rowQuestion.stem}</div>
        <div className="structured-options DSM5-options">
          {displayedOptions.map((option, displayIndex) => {
            let cls = "structured-option DSM5-option";
            if (!lockedView && option.originalIndex === rowSelected) cls += " selected";
            if (lockedView && option.originalIndex === correctIndex) cls += " correct";
            if (lockedView && option.originalIndex === rowSelected && option.originalIndex !== correctIndex) cls += " incorrect";
            return (
              <button
                key={option.originalIndex}
                type="button"
                className={cls}
                disabled={lockedView}
                onClick={() => selectAnswer(option.originalIndex)}
              >
                <span className="structured-option-letter">{OPTION_LETTERS[displayIndex] || displayIndex + 1}</span>
                <span className="DSM5-option-text">{option.text}</span>
              </button>
            );
          })}
        </div>
        {lockedView && (
          <div className="explanation-box DSM5-explanation">
            <strong>{rowSelected === correctIndex ? "Σωστό" : "Επεξήγηση"}</strong>
            <span>{rowQuestion.explanation || rowQuestion.answer || "Δεν έχει προστεθεί ακόμη επεξήγηση για αυτή την ερώτηση."}</span>
          </div>
        )}
      </div>
    );
  };

  if (reviewWrong) {
    return (
      <div className="structured-mcq">
        <div className="structured-top">
          <button className="back-link" onClick={() => setReviewWrong(false)}>
            <Icons.ChevronLeft /> Results
          </button>
        </div>
        <h2 aria-hidden="true">Επανάληψη λανθασμένων απαντήσεων</h2>
        {wrongRows.length === 0 ? (
          <div className="structured-card DSM5-empty-note">Δεν υπήρξαν λανθασμένες απαντήσεις σε αυτή τη συνεδρία.</div>
        ) : (
          <div className="DSM5-review-list">
            {wrongRows.map((row, index) => (
              <div className="DSM5-review-item" key={row.question.id}>
                {renderQuestion(row.question, row.selected, true, `Review ${index + 1}/${wrongRows.length}`)}
              </div>
            ))}
          </div>
        )}
        <div className="structured-actions">
          <button className="nav-btn" onClick={() => setReviewWrong(false)}>Πίσω στα αποτελέσματα</button>
          <button className="nav-btn primary" onClick={backToDSM5Home}>Μενού DSM5</button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="structured-mcq">
        <div className="structured-top">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
        </div>
        <h2 aria-hidden="true">DSM5</h2>
        <div className="structured-card compact DSM5-empty-note">
          Τράπεζα αυτοεξέτασης DSM5: {totalDSM5Questions} διαθέσιμες ερωτήσεις.
        </div>
        <div className="DSM5-chapter-list">
          <button className="DSM5-chapter-row featured" disabled={!totalDSM5Questions} onClick={() => startSession("random")}>
            <span className="DSM5-chapter-title">Τυχαία επιλογή</span>
            <span>{plural(totalDSM5Questions, "ερώτηση", "ερωτήσεις")}</span>
          </button>
          {dsm5trSelfExamChapters.map(chapter => {
            const count = getDSM5ChapterQuestions(chapter).length;
            return (
              <button
                key={chapter.id}
                className="DSM5-chapter-row"
                disabled={!count}
                onClick={() => startSession("chapter", chapter)}
              >
                <span className="DSM5-chapter-title">Κεφάλαιο {chapter.chapter}: {chapter.title}</span>
                <span>{plural(count, "ερώτηση", "ερωτήσεις")}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="structured-mcq">
      <div className="structured-top">
        <button className="back-link" onClick={backToDSM5Home}>
          <Icons.ChevronLeft /> DSM5 Menu
        </button>
      </div>
      <h2 aria-hidden="true">{sessionLabel}</h2>
      <div className="DSM5-session-header">
        <span>{questions.length} σύνολο</span>
        <span>{answeredCount} απαντημένες</span>
        <span>{plural(correctCount, "σωστή", "σωστές")}</span>
        <span>{plural(Math.max(0, answeredCount - correctCount), "λάθος", "λάθη")}</span>
      </div>
      {renderQuestion()}
      <div className="structured-actions DSM5-nav-row">
        <button className="nav-btn" aria-label="Προηγούμενη ερώτηση" disabled={currentIdx === 0} onClick={() => setCurrentIdx(index => Math.max(0, index - 1))}>
          <Icons.ChevronLeft />
        </button>
        <button className="nav-btn primary" disabled={selected === undefined || isLocked} onClick={lockAnswer}>
          <Icons.Lock /> Καταχώρηση
        </button>
        <button className="nav-btn" aria-label="Επόμενη ερώτηση" disabled={currentIdx >= questions.length - 1} onClick={() => setCurrentIdx(index => Math.min(questions.length - 1, index + 1))}>
          <Icons.ChevronRight />
        </button>
      </div>

      {result && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Αποτελέσματα συνεδρίας DSM5">
          <div className="modal DSM5-result-modal">
            <h3>Η συνεδρία ολοκληρώθηκε</h3>
            <div className="DSM5-session-stats">
              <span>{result.correct}/{result.total}</span>
              <span>{Math.round((result.correct / Math.max(1, result.total)) * 100)}%</span>
              <span>{plural(result.wrong, "λάθος", "λάθη")}</span>
            </div>
            <div className="modal-actions">
              <button className="results-btn" autoFocus onClick={() => setReviewWrong(true)}>Επανάληψη λανθασμένων απαντήσεων</button>
              <button className="results-btn primary" onClick={backToDSM5Home}>Μενού DSM5</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function McqVignetteMode({ progress, onProgressChange, onBack, onHome, vignettes: mcqVignettes }) {
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
      <div className="structured-mcq">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
        </div>
        <h2 aria-hidden="true">Vignettes</h2>
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
                  {completed ? "Ολοκληρώθηκε" : "Σήμανση ολοκλήρωσης"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const renderVignetteModal = () => showVignette && (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Κλινικό σενάριο" onKeyDown={event => { if (event.key === "Escape") setShowVignette(false); }} onClick={() => setShowVignette(false)}>
      <div className="modal vignette-modal" onClick={event => event.stopPropagation()}>
        <div className="vignette-modal-close">
          <button className="nav-btn" type="button" autoFocus onClick={() => setShowVignette(false)}>
            <Icons.X /> Κλείσιμο
          </button>
        </div>
        <div className="structured-card">
          <div className="structured-top">
            <strong>{vignetteLabel}</strong>
            <span className="structured-progress">{plural(vignette.questions.length, "ερώτηση", "ερωτήσεις")}</span>
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
          <strong>Επεξήγηση</strong>
          {reviewedQuestion.explanation}
        </div>
      </div>
    );
  };

  if (result && reviewIdx !== null) {
    const row = result.rows[reviewIdx];
    return (
      <div className="structured-mcq">
        <div className="screen-topbar">
          <button className="back-link" onClick={() => setReviewIdx(null)}>
            <Icons.ChevronLeft /> Results
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
      <div className="results written-results">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
        </div>
        <div className={`results-score ${getPercentageColorClass(percent)}`}>{percent}%</div>
        <div className="results-label">Αποτελέσματα Vignettes</div>
        <div className="results-detail">
          {result.correct}/{result.total} correct, {result.wrong} wrong
          {result.unanswered > 0 ? ", " + result.unanswered + " unanswered" : ""}
        </div>
        <div className="written-result-grid">
          <div className="written-result-stat">
            <strong>{result.correct}</strong>
            <span>Σωστές</span>
          </div>
          <div className="written-result-stat">
            <strong>{result.wrong}</strong>
            <span>Λάθος</span>
          </div>
          <div className="written-result-stat">
            <strong>{result.unanswered}</strong>
            <span>Αναπάντητες</span>
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
      <div className="structured-mcq">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
        </div>
        <h2 aria-hidden="true">Vignettes</h2>
        <div className="structured-card">
          <div className="structured-top">
            <strong>{vignetteLabel}</strong>
            <span className="structured-progress">{plural(vignette.questions.length, "ερώτηση", "ερωτήσεις")}</span>
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
    <div className="structured-mcq">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Μενού MCQ
        </button>
      </div>

      <div className="vignette-split-grid">
        <div className="structured-card vignette-case-pane">
          <div className="structured-top">
            <span className="sheet-eyebrow">Κλινικό Σενάριο</span>
            <strong>{vignetteLabel}</strong>
          </div>
          <div className="vignette-text" style={{ marginTop: "var(--s3)", lineHeight: 1.6 }}>
            {vignette.vignette}
          </div>
        </div>

        <div className="vignette-questions-pane">
          <div className="structured-card vignette-question-card">
            <div className="structured-top">
              <span className="structured-progress">Ερώτηση {currentIdx + 1}/{vignette.questions.length}</span>
              {isChosen && !isLocked && <span className="structured-progress">Επιλογή σου</span>}
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
                <strong>{sameSelection(selected, question.correct) ? "Σωστό" : "Επανάληψη"}</strong>
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
                    <Icons.Lock /> Καταχώρηση
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
        </div>
      </div>

      {renderVignetteModal()}
    </div>
  );
}

function McqMatchingMode({ onBack, onHome, matchingSets: mcqMatchingSets }) {
  const availableSets = useMemo(() => getAvailableMatchingSets(mcqMatchingSets), [mcqMatchingSets]);
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
    startMatchingSet(pickRandomMatchingSet(mcqMatchingSets, matchingSet?.id));
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
      <div className="structured-mcq">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
        </div>
        <h2 aria-hidden="true">Αντιστοίχηση</h2>
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
      <div className="structured-mcq">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
          <button className="nav-btn" type="button" onClick={() => startMatchingSet(pickRandomMatchingSet(mcqMatchingSets))}>
            Νέο σετ
          </button>
        </div>
        <h2 aria-hidden="true">Αντιστοίχηση</h2>
        <div className="structured-card">
          <div className="structured-top">
            <strong>Επιλογή σετ</strong>
            <span className="structured-progress">{plural(availableSets.length, "θέμα", "θέματα")}</span>
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
    <div className="structured-mcq">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
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
          <span className="structured-progress">{plural(matchingSet.items.length, "ερώτηση", "ερωτήσεις")}</span>
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
            <strong>{sameSelection(selected, item.correct) ? "Σωστό" : "Επανάληψη"}</strong>
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
                <Icons.Lock /> Καταχώρηση
              </button>
            )}
            {isLocked && currentIdx === matchingSet.items.length - 1 ? (
              <button className="nav-btn primary" onClick={goToRandomMatchingSet}>
                Επόμενο σετ <Icons.ChevronRight />
              </button>
            ) : (
              <button className="nav-btn" onClick={() => setCurrentIdx(index => Math.min(matchingSet.items.length - 1, index + 1))} disabled={currentIdx >= matchingSet.items.length - 1}>
                <Icons.ChevronRight />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function McqTest({ mode, progress, qualitySignals = {}, onProgressChange, onBack, onHome, sessionQuestions = null, sessionTitle = null }) {
  const initialWrittenDraftRef = useRef(mode === "written" ? getWrittenExamDraft(progress) : null);
  const initialWrittenQuestionsRef = useRef(initialWrittenDraftRef.current ? getWrittenExamDraftQuestions(initialWrittenDraftRef.current) : null);
  const initialSessionQuestionsRef = useRef(
    initialWrittenQuestionsRef.current?.length
      ? initialWrittenQuestionsRef.current
      : (Array.isArray(sessionQuestions) && sessionQuestions.length ? sessionQuestions : getSessionQuestions(mode, progress, qualitySignals))
  );
  const sessionIdRef = useRef(initialWrittenDraftRef.current?.sessionId || `${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const writtenViewedQuestionIdsRef = useRef(new Set(initialWrittenDraftRef.current?.viewedQuestionIds || []));
  const writtenRecordedAnswerIdsRef = useRef(new Set(initialWrittenDraftRef.current?.recordedAnswerQuestionIds || []));
  const startedAtRef = useRef(Date.now());
  const questionViewEffectKeyRef = useRef(null);
  const explanationRef = useRef(null);
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
  const [writtenReviewFilter, setWrittenReviewFilter] = useState("all");
  const [writtenWrongFullItem, setWrittenWrongFullItem] = useState(null);
  const [showWrittenSubmitWarning, setShowWrittenSubmitWarning] = useState(false);
  const [writtenSubmitError, setWrittenSubmitError] = useState(null);
  const [writtenDraftChoice, setWrittenDraftChoice] = useState(() => mode === "written" && Boolean(initialWrittenDraftRef.current) ? "choice" : "active");
  const [flaggedIds, setFlaggedIds] = useState(() => new Set());
  const [showSimTray, setShowSimTray] = useState(true);
  const [simSeconds, setSimSeconds] = useState(0);
  const [showSimTimer, setShowSimTimer] = useState(true);
  const [showSprintCompleteModal, setShowSprintCompleteModal] = useState(false);
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
    onProgressChange(prev => ensureDailyChallenge(prev, getLocalDateKey(), qualitySignals).progress);
  }, [mode, onProgressChange, qualitySignals]);

  useEffect(() => {
    if (mode !== "sprint" || !questions?.length) return;
    onProgressChange(prev => {
      const existing = (prev.sprintSessions || []).some(s => s.id === sessionIdRef.current);
      if (existing) return prev;
      return recordSprintSession(prev, {
        id: sessionIdRef.current,
        questionIds: questions.map(item => item.id),
        startedAt: new Date(startedAtRef.current).toISOString(),
        completedAt: null,
      });
    });
  }, [mode, questions, onProgressChange]);

  useEffect(() => {
    setOptionOrders(currentOrders => createOptionOrders(questions, currentOrders));
  }, [questions]);

  useEffect(() => {
    if (mode !== "written" || writtenResult || writtenDraftChoice === "choice") return undefined;
    const timer = setInterval(() => {
      setSimSeconds(sec => sec + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, writtenResult, writtenDraftChoice]);

  const formatSimTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleFlag = (questionId = q?.id) => {
    if (!questionId) return;
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

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

  useEffect(() => {
    if (!isLocked || mode === "written") return undefined;
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      explanationRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLocked, mode, q?.id]);

  const toggleBookmark = (questionId = q?.id) => {
    if (!questionId) return;
    const current = Boolean(progress?.bookmarks?.[questionId] || progress?.bookmarks?.[String(questionId)]);
    onProgressChange?.(previous => {
      const base = normalizeMcqProgress(previous);
      const nextBookmarks = { ...base.bookmarks };
      if (current) {
        delete nextBookmarks[questionId];
        delete nextBookmarks[String(questionId)];
      } else {
        nextBookmarks[questionId] = true;
      }
      return {
        ...base,
        bookmarks: nextBookmarks,
        updatedAt: new Date().toISOString(),
      };
    });
  };

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
    if (mode === "sprint" && currentIdx === totalQ - 1) {
      setShowSprintCompleteModal(true);
    }
    onProgressChange(prev => recordQuestionAnswer(prev, q, selectedOverride, {
      mode,
      confidence: inferredConfidence,
      timeTakenMs,
      pointsAwarded,
      pointBreakdown,
      sessionId: sessionIdRef.current,
      streakPosition: nextStreak,
    }));
  }, [selected, isLocked, q, sessionStats, mode, onProgressChange, currentIdx, totalQ]);

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

  // Keyboard: answering thousands of MCQs should not require the mouse.
  // 1–5 and Up/Down pick an option; Enter/Space submit, then advance.
  useWindowKeydown(event => {
    {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isShortcutIgnoredTarget(event.target)) return;
      if (writtenResult || !q) return;

      if (event.key >= "1" && event.key <= "9") {
        const displayedIndex = Number(event.key) - 1;
        const order = getStoredOptionOrder(q, optionOrders);
        if (displayedIndex >= order.length) return;
        event.preventDefault();
        selectOption(order[displayedIndex]);
        return;
      }

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isLocked) {
        if (!currentOptionOrder.length) return;
        event.preventDefault();
        const selectedPosition = currentOptionOrder.indexOf(selected);
        const step = event.key === "ArrowDown" ? 1 : -1;
        const nextPosition = selectedPosition < 0
          ? (step > 0 ? 0 : currentOptionOrder.length - 1)
          : (selectedPosition + step + currentOptionOrder.length) % currentOptionOrder.length;
        selectOption(currentOptionOrder[nextPosition]);
        return;
      }

      if (isSubmitOrAdvanceKey(event)) {
        event.preventDefault();
        if (event.repeat) return;
        if (!isLocked && selected !== undefined && selected !== null && mode !== "written") {
          submitAnswer();
        } else if (nextIdx >= 0 && nextIdx < totalQ) {
          if (mode === "written") goToWrittenIndex(nextIdx);
          else goToNextQuestion();
        }
        return;
      }

      if (event.key === "ArrowRight" && nextIdx >= 0 && nextIdx < totalQ) {
        event.preventDefault();
        if (mode === "written") goToWrittenIndex(nextIdx);
        else goToNextQuestion();
        return;
      }

      if (event.key === "ArrowLeft" && prevIdx >= 0) {
        event.preventDefault();
        if (mode === "written") goToWrittenIndex(prevIdx);
        else setCurrentIdx(prevIdx);
      }
    }
  });

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
      setFeedbackStatus({
        type: "success",
        message: feedbackType === "comment"
          ? "Το σχόλιο καταχωρήθηκε."
          : feedbackType === MCQ_QUALITY_FEEDBACK.up
            ? "Καταγράφηκε ως καλή ερώτηση."
            : feedbackType === MCQ_QUALITY_FEEDBACK.down
              ? "Καταγράφηκε ως προβληματική ερώτηση."
              : "Η παρατήρηση καταχωρήθηκε.",
      });
      setFeedbackMenuOpen(false);
      setFeedbackCommentOpen(false);
      setFeedbackCommentText("");
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
      <button
        type="button"
        className={`mcq-quality-btn bookmark ${Boolean(progress?.bookmarks?.[feedbackQuestion.id] || progress?.bookmarks?.[String(feedbackQuestion.id)]) ? "active" : ""}`}
        title={Boolean(progress?.bookmarks?.[feedbackQuestion.id] || progress?.bookmarks?.[String(feedbackQuestion.id)]) ? "Αφαίρεση από τα σημειωμένα" : "Προσθήκη στα σημειωμένα"}
        aria-label={Boolean(progress?.bookmarks?.[feedbackQuestion.id] || progress?.bookmarks?.[String(feedbackQuestion.id)]) ? "Αφαίρεση από τα σημειωμένα" : "Προσθήκη στα σημειωμένα"}
        onClick={() => toggleBookmark(feedbackQuestion.id)}
      >
        <Icons.Bookmark filled={Boolean(progress?.bookmarks?.[feedbackQuestion.id] || progress?.bookmarks?.[String(feedbackQuestion.id)])} />
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
            <div className="question-num">Ερώτηση {question.id}</div>
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
                <span className="option-letter" aria-hidden="true">{letter}</span>
                <span>{option.text}</span>
                <span className="answer-glyph" aria-hidden="true">
                  {originalIndex === question.correct ? <Icons.Check /> :
                   originalIndex === item.selected && originalIndex !== question.correct ? <Icons.X /> : null}
                </span>
                <span className="sr-only">
                  {originalIndex === question.correct
                    ? `Επιλογή ${letter}. Σωστή απάντηση.`
                    : originalIndex === item.selected
                      ? `Επιλογή ${letter}. Η απάντησή σου — λάθος.`
                      : `Επιλογή ${letter}.`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="explanation-box">
          <strong>Επεξήγηση</strong>{question.explanation}
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
    const nextQuestions = getSessionQuestions("written", progress, qualitySignals);
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
  }, [onProgressChange, progress, qualitySignals]);

  const continueWrittenExam = useCallback(() => {
    setWrittenDraftChoice("active");
    persistWrittenDraft();
  }, [persistWrittenDraft]);

  const restartWrittenExam = () => {
    startNewWrittenExam();
  };

  const startNewSprint = () => {
    const nextSessionId = `sprint-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextQuestions = getSessionQuestions("sprint", progress, qualitySignals);
    sessionIdRef.current = nextSessionId;
    startedAtRef.current = Date.now();
    questionViewEffectKeyRef.current = null;
    setQuestions(nextQuestions);
    setOptionOrders(createOptionOrders(nextQuestions));
    setCurrentIdx(0);
    setAnswers({});
    setLocked({});
    setLastBreakdown(null);
    setSessionStats({ correct: 0, incorrect: 0, total: 0, currentStreak: 0, maxStreak: 0, points: 0 });
    setFeedbackMenuOpen(false);
    setFeedbackStatus(null);
    setFeedbackCommentOpen(false);
    setFeedbackCommentText("");
    setShowSprintCompleteModal(false);
    onProgressChange(prev => recordSprintSession(prev, {
      id: nextSessionId,
      questionIds: nextQuestions.map(item => item.id),
      startedAt: new Date().toISOString(),
      completedAt: null,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (mode === "written" && writtenDraftChoice === "choice") {
    const draftUpdatedAt = initialWrittenDraftRef.current?.updatedAt
      ? new Date(initialWrittenDraftRef.current.updatedAt).toLocaleString("el-GR")
      : null;

    return (
      <div className="test-container">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Μενού MCQ
        </button>

        <div className="oral-choice">
          <h2>Προσομοίωση με 100 Πολλαπλής</h2>
          <p>Υπάρχει αποθηκευμένη ημιτελής γραπτή προσομοίωση για αυτό το προφίλ.</p>
          <div className="game-hud">
            <div className="hud-stat">
              <span className="hud-value">{currentIdx + 1}</span>
              <span className="hud-label">Τρέχουσα</span>
            </div>
            <div className="hud-stat">
              <span className="hud-value">{writtenAnsweredCount}</span>
              <span className="hud-label">Απαντημένες</span>
            </div>
            <div className="hud-stat">
              <span className="hud-value">{writtenUnansweredCount}</span>
              <span className="hud-label">Αναπάντητες</span>
            </div>
            <div className="hud-stat">
              <span className="hud-value">{totalQ}</span>
              <span className="hud-label">Σύνολο</span>
            </div>
          </div>
          {draftUpdatedAt && (
            <div className="explanation-box">
              <strong>Αποθηκευμένη πρόοδος</strong>
              Τελευταία ενημέρωση: {draftUpdatedAt}
            </div>
          )}
          <button className="mode-btn featured" onClick={continueWrittenExam}>
            Συνέχεια αποθηκευμένης εξέτασης
            <small>Συνέχισε από την ερώτηση {currentIdx + 1} με τις αποθηκευμένες επιλογές.</small>
          </button>
          <button className="mode-btn" onClick={startNewWrittenExam}>
            Νέα εξέταση
            <small>Διέγραψε την αποθηκευμένη προσομοίωση αυτού του προφίλ και δημιούργησε νέα.</small>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "written" && writtenResult && reviewWrittenAll) {
    const allReviewItems = writtenResult.items || [];
    const filteredReviewItems = allReviewItems.filter(item => {
      if (writtenReviewFilter === "wrong") return item.selected !== item.question.correct && item.selected !== undefined && item.selected !== null;
      if (writtenReviewFilter === "correct") return item.selected === item.question.correct;
      if (writtenReviewFilter === "unanswered") return item.selected === undefined || item.selected === null;
      if (writtenReviewFilter === "bookmarked") return Boolean(progress?.bookmarks?.[item.question.id] || progress?.bookmarks?.[String(item.question.id)]);
      return true;
    });

    const safeReviewIndex = Math.min(writtenReviewIndex, Math.max(0, filteredReviewItems.length - 1));
    const reviewItem = filteredReviewItems[safeReviewIndex] || filteredReviewItems[0];
    const bookmarkedCount = allReviewItems.filter(item => Boolean(progress?.bookmarks?.[item.question.id] || progress?.bookmarks?.[String(item.question.id)])).length;

    return (
      <div className="test-container written-review">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
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
        </div>

        <div className="sheet-head" style={{ marginBottom: "var(--s4)" }}>
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Ανασκόπηση Προσομοίωσης</span>
            <h2>Ανάλυση Ερωτήσεων</h2>
          </div>
        </div>

        <div className="review-filter-bar">
          <button
            type="button"
            className={`review-filter-pill ${writtenReviewFilter === "all" ? "active" : ""}`}
            onClick={() => { setWrittenReviewFilter("all"); setWrittenReviewIndex(0); }}
          >
            Όλες ({allReviewItems.length})
          </button>
          <button
            type="button"
            className={`review-filter-pill ${writtenReviewFilter === "wrong" ? "active" : ""}`}
            onClick={() => { setWrittenReviewFilter("wrong"); setWrittenReviewIndex(0); }}
          >
            <Icons.X /> Λάθη ({writtenResult.wrong})
          </button>
          <button
            type="button"
            className={`review-filter-pill ${writtenReviewFilter === "correct" ? "active" : ""}`}
            onClick={() => { setWrittenReviewFilter("correct"); setWrittenReviewIndex(0); }}
          >
            <Icons.Check /> Σωστές ({writtenResult.correct})
          </button>
          {writtenResult.unanswered > 0 && (
            <button
              type="button"
              className={`review-filter-pill ${writtenReviewFilter === "unanswered" ? "active" : ""}`}
              onClick={() => { setWrittenReviewFilter("unanswered"); setWrittenReviewIndex(0); }}
            >
              Αναπάντητες ({writtenResult.unanswered})
            </button>
          )}
          <button
            type="button"
            className={`review-filter-pill ${writtenReviewFilter === "bookmarked" ? "active" : ""}`}
            onClick={() => { setWrittenReviewFilter("bookmarked"); setWrittenReviewIndex(0); }}
          >
            <Icons.Bookmark filled={writtenReviewFilter === "bookmarked"} /> Σημειωμένες ({bookmarkedCount})
          </button>
        </div>

        <div className="review-q-grid">
          {allReviewItems.map((item, idx) => {
            const isCorrect = item.selected === item.question.correct;
            const isUnanswered = item.selected === undefined || item.selected === null;
            const isItemInFilter = filteredReviewItems.includes(item);
            const isCurrent = reviewItem && reviewItem.question.id === item.question.id;
            const statusClass = isUnanswered ? "unanswered" : isCorrect ? "correct" : "incorrect";

            return (
              <button
                key={item.question.id}
                type="button"
                className={`review-q-chip ${statusClass} ${isCurrent ? "current" : ""}`}
                style={{ opacity: isItemInFilter ? 1 : 0.35 }}
                title={`Ερώτηση ${idx + 1} (${isUnanswered ? "Αναπάντητη" : isCorrect ? "Σωστή" : "Λάθος"})`}
                onClick={() => {
                  const targetFilteredIdx = filteredReviewItems.indexOf(item);
                  if (targetFilteredIdx >= 0) {
                    setWrittenReviewIndex(targetFilteredIdx);
                  } else {
                    setWrittenReviewFilter("all");
                    setWrittenReviewIndex(idx);
                  }
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {reviewItem ? (
          <>
            {renderLockedWrittenQuestion(reviewItem)}
            <div className="structured-actions" style={{ marginTop: "var(--s4)" }}>
              <button
                className="nav-btn"
                onClick={() => setWrittenReviewIndex(index => Math.max(0, index - 1))}
                disabled={safeReviewIndex === 0}
              >
                <Icons.ChevronLeft /> Προηγούμενη
              </button>
              <span className="structured-progress">
                {safeReviewIndex + 1} / {filteredReviewItems.length}
              </span>
              <button
                className="nav-btn"
                onClick={() => setWrittenReviewIndex(index => Math.min(filteredReviewItems.length - 1, index + 1))}
                disabled={safeReviewIndex >= filteredReviewItems.length - 1}
              >
                Επόμενη <Icons.ChevronRight />
              </button>
            </div>
          </>
        ) : (
          <div className="explanation-box">
            <strong>Δεν υπάρχουν ερωτήσεις στο επιλεγμένο φίλτρο</strong>
          </div>
        )}
      </div>
    );
  }

  if (mode === "written" && writtenResult && reviewWrittenWrong) {
    if (writtenWrongFullItem) {
      return (
        <div className="test-container written-review">
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
          </div>
          {renderLockedWrittenQuestion(writtenWrongFullItem)}
        </div>
      );
    }

    return (
      <div className="test-container written-review">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={() => setReviewWrittenWrong(false)}>
            <Icons.ChevronLeft /> Results
          </button>
        </div>
        <h2>Επανάληψη λανθασμένων απαντήσεων</h2>
        {writtenResult.wrongItems.length === 0 ? (
          <div className="explanation-box">
            <strong>Δεν υπήρξαν λανθασμένες απαντήσεις</strong>
            Όλες οι απαντημένες ερωτήσεις σε αυτή την προσομοίωση ήταν σωστές.
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
                    <span>Ερώτηση {index + 1}</span>
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
                    <strong>Η απάντησή σου</strong>
                    <span>{getDisplayedOptionLetter(question, item.selected, optionOrders)}. {question.options[item.selected]}</span>
                  </div>
                  <div className="written-answer-row correct">
                    <strong>Σωστή απάντηση</strong>
                    <span>{getDisplayedOptionLetter(question, question.correct, optionOrders)}. {question.options[question.correct]}</span>
                  </div>
                  <div className="written-meta-row">
                    <span className="meta-pill">{getQuestionTopic(question)}</span>
                    {subtopic && <span className="meta-pill">{subtopic}</span>}
                  </div>
                  <div className="explanation-box">
                    <strong>Επεξήγηση</strong>
                    {question.explanation}
                  </div>
                  {examLesson && (
                    <div className="explanation-box exam-lesson">
                      <strong>Τι κρατάμε</strong>
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
      <div className="results written-results">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 24 }}>
          <button className="back-link" style={{ marginBottom: 0 }} onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
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
            <span>Σωστές</span>
          </div>
          <div className="written-result-stat">
            <strong>{writtenResult.wrong}</strong>
            <span>Λάθος</span>
          </div>
          <div className="written-result-stat">
            <strong>{writtenResult.unanswered}</strong>
            <span>Αναπάντητες</span>
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
            Νέα προσομοίωση
          </button>
          <button className="results-btn" onClick={onHome}>
            <Icons.Home /> Αρχική
          </button>
        </div>
      </div>
    );
  }

  if (!q) {
    if (mode === "bookmarks") {
      return (
        <div className="test-container">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
          <div className="sheet-head" style={{ marginTop: "var(--s3)" }}>
            <div className="sheet-head-text">
              <span className="sheet-eyebrow">Πολλαπλής Επιλογής</span>
              <h2>Σημειωμένες Ερωτήσεις</h2>
              <span className="sheet-sub">Δεν υπάρχουν ακόμα σημειωμένες ερωτήσεις</span>
            </div>
          </div>
          <div className="explanation-box" style={{ marginTop: "var(--s4)" }}>
            <strong>Πώς λειτουργεί:</strong>
            Κατά τη διάρκεια οποιουδήποτε τεστ (Mini-test, Τυχαία, Προσομοίωση, κλπ) ή κατά την ανασκόπηση, πάτησε το κουμπί σελιδοδείκτη (<Icons.Bookmark filled style={{ verticalAlign: "middle" }} />) για να προσθέσεις μία ερώτηση στις σημειωμένες.
          </div>
          <div className="results-actions" style={{ marginTop: "var(--s5)" }}>
            <button className="results-btn primary" onClick={onBack}>
              Επιστροφή στο Μενού MCQ
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="test-container">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Μενού MCQ
        </button>
        <div className="explanation-box">
          <strong>Δεν υπάρχουν ακόμη ερωτήσεις σε αυτή τη λειτουργία</strong>
          Δεν υπάρχουν αρκετές διαθέσιμες ερωτήσεις για αυτή τη λειτουργία σε αυτό το προφίλ.
        </div>
      </div>
    );
  }

  return (
    <div className="test-container mcq-layout-wrap">
      <div className="mcq-main-pane">
        <div className="mcq-top-nav">
          <button className="back-link" onClick={onBack} style={{ margin: 0 }}>
            <Icons.ChevronLeft /> Μενού MCQ
          </button>
          {flaggedIds.size > 0 && (
            <span className="mcq-top-flag-badge">
              🚩 {flaggedIds.size} για έλεγχο
            </span>
          )}
        </div>

        <div className="mcq-question-header">
          <div className="mcq-q-info">
            <span className="mcq-q-index">Ερώτηση {currentIdx + 1} <small>/ {totalQ}</small></span>
            <span className="mcq-q-id">#{q.id}</span>
            {mode !== "written" && questionStatus && (
              <span className={`question-status ${questionStatus.toLowerCase()}`}>
                {questionStatus}
              </span>
            )}
            {mode !== "written" && dailyReason && (
              <span className="question-status seen">{getDailyReasonLabel(dailyReason)}</span>
            )}
          </div>

          <div className="mcq-q-actions">
            {mode === "written" && (
              <button
                type="button"
                className={`sim-flag-btn ${flaggedIds.has(q.id) ? "active" : ""}`}
                onClick={() => toggleFlag(q.id)}
                title={flaggedIds.has(q.id) ? "Αφαίρεση σημαίας ελέγχου" : "Σημείωση για επανέλεγχο"}
              >
                🚩 {flaggedIds.has(q.id) ? "Σημειωμένη" : "Έλεγχος"}
              </button>
            )}
            {renderMcqFeedbackControls(q)}
          </div>
        </div>

        {feedbackStatus && (
          <div className={`mcq-feedback-message ${feedbackStatus.type}`} role="status" aria-live="polite">
            {feedbackStatus.message}
          </div>
        )}
        {mode === "written" && writtenSubmitError && (
          <div className="mcq-feedback-message error">
            {writtenSubmitError}
          </div>
        )}
        <div className="question-stem" id="mcq-question-stem">{getMcqStem(q)}</div>

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
              <button
                key={originalIndex}
                className={cls}
                onClick={() => selectOption(originalIndex)}
                aria-pressed={originalIndex === selected}
                aria-describedby="mcq-question-stem"
              >
                <span className="option-letter" aria-hidden="true">{letter}</span>
                <span>{option.text}</span>
                <span className="answer-glyph" aria-hidden="true">
                  {isLocked && originalIndex === q.correct ? <Icons.Check /> :
                   isLocked && originalIndex === selected && originalIndex !== q.correct ? <Icons.X /> : null}
                </span>
                <span className="sr-only">
                  {isLocked && originalIndex === q.correct
                    ? `Επιλογή ${letter}. Σωστή απάντηση.`
                    : isLocked && originalIndex === selected
                      ? `Επιλογή ${letter}. Η απάντησή σου — λάθος.`
                      : `Επιλογή ${letter}.`}
                </span>
              </button>
            );
          })}
        </div>

        {isLocked && (
          <p className="answer-verdict sr-only" role="status">
            {selected === q.correct
              ? "Σωστή απάντηση."
              : `Λάθος. Σωστή είναι η ${String.fromCharCode(913 + displayedOptions.findIndex(option => option.originalIndex === q.correct))}.`}
          </p>
        )}

        {isLocked && mode !== "written" && (
          <div ref={explanationRef} className="explanation-box" role="status" aria-live="polite">
            <strong>Επεξήγηση</strong>{q.explanation}
            {getQuestionExamLesson(q) && (
              <div className="exam-takeaway-card">
                <strong>Τι κρατάμε</strong>
                {getQuestionExamLesson(q)}
              </div>
            )}
          </div>
        )}

        {mode === "written" ? (
          <div className="nav-bar actionbar">
            <button className="nav-btn" onClick={() => goToWrittenIndex(prevIdx)} disabled={prevIdx < 0} aria-label="Προηγούμενη ερώτηση">
              <Icons.ChevronLeft /> Προηγούμενη
            </button>
            <button className="nav-btn" onClick={() => goToWrittenIndex(nextIdx)} disabled={nextIdx < 0 || nextIdx >= totalQ} aria-label="Επόμενη ερώτηση">
              Επόμενη <Icons.ChevronRight />
            </button>
            <button className="nav-btn primary" type="button" onClick={() => submitWrittenExam(false)}>
              Υποβολή εξέτασης
            </button>
          </div>
        ) : mode === "sprint" && currentIdx === totalQ - 1 ? (
          <div className="nav-bar actionbar">
            <button className="nav-btn" onClick={() => setCurrentIdx(prevIdx)} disabled={prevIdx < 0} aria-label="Προηγούμενη ερώτηση">
              <Icons.ChevronLeft /> Προηγούμενη
            </button>
            {!isLocked && (
              <button className="nav-btn primary" onClick={() => { submitAnswer(); setShowSprintCompleteModal(true); }} disabled={selected === undefined}>
                <Icons.Lock /> Καταχώρηση
              </button>
            )}
            <button className="nav-btn primary" type="button" onClick={startNewSprint}>Νέο mini-test</button>
          </div>
        ) : (
          <div className="nav-bar actionbar">
            <button className="nav-btn" onClick={() => setCurrentIdx(prevIdx)} disabled={prevIdx < 0} aria-label="Προηγούμενη ερώτηση">
              <Icons.ChevronLeft /> Προηγούμενη
            </button>
            {!isLocked && (
              <button className="nav-btn primary" onClick={() => submitAnswer()} disabled={selected === undefined}>
                <Icons.Lock /> Καταχώρηση
              </button>
            )}
            <button
              className="nav-btn"
              onClick={goToNextQuestion}
              disabled={nextIdx < 0 || nextIdx >= totalQ}
              aria-label="Επόμενη ερώτηση"
            >
              Επόμενη <Icons.ChevronRight />
            </button>
          </div>
        )}
      </div>

      <aside className="mcq-side-rail" aria-label="Πρόοδος εξέτασης">
        <div className="mcq-rail-header">
          <span className="mcq-rail-title">{modeTitle}</span>
          <div
            className="mcq-rail-timer"
            onClick={() => setShowSimTimer(t => !t)}
            title="Χρόνος (κλικ για εναλλαγή)"
          >
            ⏱️ {showSimTimer ? formatSimTime(simSeconds) : "••:••"}
          </div>
        </div>

        <div className="mcq-rail-progress-box">
          <div className="mcq-rail-stat-row">
            <span className="mcq-rail-stat-label">Πρόοδος</span>
            <strong className="mcq-rail-stat-val">{currentIdx + 1} / {totalQ}</strong>
          </div>
          <div className="progress-bar" style={{ marginTop: 4, height: 6 }}>
            <div
              className="progress-fill"
              style={{
                width: `${totalQ > 0 ? ((currentIdx + 1) / totalQ) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {mode === "written" ? (
          <div className="mcq-rail-sim-stats">
            <div className="mcq-rail-stat-card">
              <span>Απαντημένες</span>
              <strong>{writtenAnsweredCount} <small>/ {totalQ}</small></strong>
            </div>
            <div className="mcq-rail-stat-card">
              <span>Αναπάντητες</span>
              <strong>{writtenUnansweredCount}</strong>
            </div>
            {flaggedIds.size > 0 && (
              <div className="mcq-rail-stat-card flagged">
                <span>Σημειωμένες</span>
                <strong>🚩 {flaggedIds.size}</strong>
              </div>
            )}

            <button
              type="button"
              className="sim-tray-toggle-btn"
              style={{ width: "100%", justifyContent: "center", marginTop: "var(--s2)" }}
              onClick={() => setShowSimTray(open => !open)}
            >
              📋 Πλοηγός 1–100 {showSimTray ? "▲" : "▼"}
            </button>

            {showSimTray && (
              <div className="review-q-grid" style={{ marginTop: "var(--s3)", maxHeight: "280px", overflowY: "auto", padding: "4px" }}>
                {questions.map((item, idx) => {
                  const isAnswered = answers[item.id] !== undefined && answers[item.id] !== null;
                  const isFlagged = flaggedIds.has(item.id);
                  const isCurrent = currentIdx === idx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`review-q-chip sim-q-chip ${isAnswered ? "correct" : "unanswered"} ${isFlagged ? "flagged" : ""} ${isCurrent ? "current" : ""}`}
                      onClick={() => goToWrittenIndex(idx)}
                      title={`Ερώτηση ${idx + 1} (${isAnswered ? "Απαντημένη" : "Αναπάντητη"}${isFlagged ? " · Σημειωμένη" : ""})`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mcq-rail-sim-stats">
            <div className="mcq-rail-stat-card">
              <span>Σωστές</span>
              <strong style={{ color: "var(--accent)" }}>{sessionStats.correct}</strong>
            </div>
            <div className="mcq-rail-stat-card">
              <span>Λάθη</span>
              <strong style={{ color: "var(--mark)" }}>{sessionStats.incorrect}</strong>
            </div>
            {sessionStats.currentStreak > 0 && (
              <div className="mcq-rail-stat-card">
                <span>Σερί</span>
                <strong>🔥 {sessionStats.currentStreak}</strong>
              </div>
            )}
          </div>
        )}
      </aside>

      {showWrittenSubmitWarning && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Επιβεβαίωση υποβολής γραπτής εξέτασης" onKeyDown={event => { if (event.key === "Escape") setShowWrittenSubmitWarning(false); }}>
          <div className="modal">
            <h3>Υποβολή γραπτής εξέτασης;</h3>
            <p>
              Έχεις απαντήσει <strong>{writtenAnsweredCount}</strong> από <strong>{totalQ}</strong> ερωτήσεις.
              {writtenUnansweredCount > 0
                ? ` ${writtenUnansweredCount} θα παραμείνουν αναπάντητες και θα υπολογιστούν ως μη σωστές.`
                : " Δεν υπάρχουν αναπάντητες ερωτήσεις."}
            </p>
            {flaggedIds.size > 0 && (
              <p style={{ color: "var(--due)", fontWeight: 600 }}>
                ⚠️ Έχεις {flaggedIds.size} ερωτήσεις σημειωμένες για επανέλεγχο.
              </p>
            )}
            <div className="modal-actions">
              <button className="results-btn primary" onClick={() => submitWrittenExam(true)}>
                Υποβολή και αποτελέσματα
              </button>
              <button className="results-btn" autoFocus onClick={() => setShowWrittenSubmitWarning(false)}>
                Συνέχεια εξέτασης
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "sprint" && showSprintCompleteModal && (
        <div className="sprint-summary-overlay" role="dialog" aria-modal="true">
          <div className="sprint-summary-card">
            <div className="sheet-eyebrow">Mini-Test Ολοκληρώθηκε</div>
            <div className="sprint-score-badge">
              {sessionStats.correct} <small>/ {totalQ}</small>
            </div>
            <p style={{ color: "var(--ink-2)", margin: 0 }}>
              Ευστοχία: <strong>{Math.round((sessionStats.correct / (totalQ || 1)) * 100)}%</strong>
              {sessionStats.maxStreak > 1 && ` · Μέγιστο σερί: ${sessionStats.maxStreak}`}
            </p>
            <div className="modal-actions" style={{ width: "100%", marginTop: "var(--s2)" }}>
              <button
                type="button"
                className="results-btn primary"
                onClick={startNewSprint}
              >
                <Icons.Bolt /> Επόμενο Mini-Test (Νέες 10)
              </button>
              <button
                type="button"
                className="results-btn"
                onClick={() => setShowSprintCompleteModal(false)}
              >
                Ανασκόπηση ερωτήσεων
              </button>
              <button
                type="button"
                className="results-btn"
                onClick={onBack}
              >
                Μενού MCQ
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

// The section landing: three distinct functions, visible up front — not a
// question list that happens to also link to the other two. Mirrors the
// MCQ hub's own split between "pick a mode" and "the mode itself".
function OralHub({ onOpenPast, onOpenSimulator, onOpenCrucialQuestions, canAccessCrucialQuestions, oralProgress }) {
  const overallSummary = summarizeOralProgress(normalizeOralProgress(oralProgress));
  const level = overallSummary.total ? Math.round((overallSummary.mastered / overallSummary.total) * 5) : 0;

  const modes = [
    {
      id: "past",
      icon: <Icons.BookOpen />,
      title: "Σημαντικά Θέματα",
      stat: `${overallSummary.mastered}/${overallSummary.total} κατακτημένα`,
      onOpen: onOpenPast,
    },
    {
      id: "simulator",
      icon: <Icons.Mic />,
      title: "Προφορική Εξέταση",
      stat: "Νέα εξέταση κάθε φορά",
      onOpen: onOpenSimulator,
    },
  ];
  if (canAccessCrucialQuestions) {
    modes.push({
      id: "crucial",
      icon: <Icons.FileText />,
      title: "100 Κρίσιμα Θέματα",
      stat: "100 θέματα σε 16 κεφάλαια",
      onOpen: onOpenCrucialQuestions,
    });
  }

  return (
    <div className="oral-container oral-hub-screen">
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Ενότητα</span>
          <h2>Προφορικά</h2>
          <span className="sheet-sub">Προετοιμασία για την προφορική εξέταση</span>
        </div>
        <div className="sheet-head-actions">
          <ScaleStrip size="lg" level={level} label="Πρόοδος προφορικών" />
          <span className="plate">{overallSummary.mastered}/{overallSummary.total}</span>
        </div>
      </div>

      <div className="oral-hub-grid">
        {modes.map(mode => (
          <button key={mode.id} type="button" className="oral-hub-tile" onClick={mode.onOpen}>
            <span className="oral-hub-icon" aria-hidden="true">{mode.icon}</span>
            <span className="oral-hub-body">
              <span className="oral-hub-title">{mode.title}</span>
              <span className="oral-hub-stat">{mode.stat}</span>
            </span>
            <span className="oral-hub-go" aria-hidden="true"><Icons.ChevronRight /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

// The dataset carries raw framework-default hexes. The bands are an ordered
// severity scale, so they are drawn from the themed ramp instead — which also
// keeps them legible in both themes.
function getGravityColor(gravity) {
  const step = Math.min(Math.max(Number(gravity?.id) || 1, 1), 5);
  return `var(--sev-${step})`;
}

function OralAccordion({ onBack, onHome, onNavigateToViewer, onNavigateToTable, oralProgress }) {
  const [view, setView] = useState("bands");
  const [query, setQuery] = useState("");
  // Two levels, not four: the frequency ladder, then everything inside one
  // band on a single grouped page. A question is always one click from the
  // ladder, and the topic/subtopic structure is shown as headings rather
  // than as more things to click through.
  const [openBandId, setOpenBandId] = useState(null);
  const normalizedOralProgress = normalizeOralProgress(oralProgress);
  const overallSummary = summarizeOralProgress(normalizedOralProgress);

  const allEntries = useMemo(() => oralData.flatMap(gravity =>
    (gravity.topics || []).flatMap(topic => topic.subtopics
      ? topic.subtopics.flatMap(subtopic => subtopic.questions.map(question => ({ question, gravity, topic, subtopic })))
      : (topic.questions || []).map(question => ({ question, gravity, topic, subtopic: null })))
  ), []);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = normalizeGreekSearch(query);
    if (!normalizedQuery) return allEntries;
    return allEntries.filter(({ question, gravity, topic, subtopic }) => normalizeGreekSearch(
      `${question.id} ${question.text} ${gravity.title} ${topic.title} ${subtopic?.title || ""}`
    ).includes(normalizedQuery));
  }, [allEntries, query]);

  const openBand = openBandId ? oralData.find(gravity => gravity.id === openBandId) : null;

  const renderProgressPill = (questions) => {
    const summary = summarizeOralProgress(normalizedOralProgress, questions);
    return (
      <span className={`oral-progress-pill ${summary.total > 0 && summary.mastered === summary.total ? "complete" : ""}`}>
        {summary.mastered}/{summary.total}
      </span>
    );
  };

  const renderQuestionList = (questions, title, context) => (
    <ol className="oral-question-list">
      {questions.map((question, index) => {
        const isMastered = Boolean(normalizedOralProgress.mastered[question.id]);
        return (
          <li key={question.id}>
            <button className="oral-question-row" type="button" onClick={() => onNavigateToViewer(questions, title, index)}>
              <span className="oral-question-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="oral-question-copy"><span className="oral-question-text">{question.text}</span>{context && <span className="oral-question-context">{context}</span>}</span>
              <span className={`oral-question-state ${isMastered ? "mastered" : ""}`} aria-label={isMastered ? "Mastered" : "Άνοιγμα"}>{isMastered ? <Icons.Check /> : <Icons.ChevronRight />}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="oral-container">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Προφορικά
        </button>
      </div>

      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Προφορικά</span>
          <h2>Σημαντικά Θέματα</h2>
          <span className="sheet-sub">
            {allEntries.length} ερωτήσεις εξετάσεων, με τις απαντήσεις τους
          </span>
        </div>
        <div className="sheet-head-actions">
          <ScaleStrip
            size="lg"
            level={overallSummary.total ? Math.round((overallSummary.mastered / overallSummary.total) * 5) : 0}
            label="Πρόοδος προφορικών"
          />
          <span className="plate">{overallSummary.mastered}/{overallSummary.total}</span>
        </div>
      </div>

      {!openBand && (
        <div className="oral-index-controls">
          <div className="oral-index-tabs" aria-label="Προβολή θεμάτων">
            <button className="oral-index-tab" type="button" aria-pressed={view === "bands"} onClick={() => setView("bands")}>Κατά συχνότητα</button>
            <button className="oral-index-tab" type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>Όλες ({allEntries.length})</button>
          </div>
        </div>
      )}

      {view === "all" && !openBand && (
        <>
          <div className="oral-search"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Αναζήτηση στις 129 ερωτήσεις…" aria-label="Αναζήτηση στις προηγούμενες ερωτήσεις" /></div>
          <div className="oral-index-count">{visibleEntries.length === allEntries.length ? `${plural(allEntries.length, "ερώτηση", "ερωτήσεις")}` : `${visibleEntries.length} από ${plural(allEntries.length, "ερώτηση", "ερωτήσεις")}`}</div>
          <ol className="oral-question-list">
            {visibleEntries.map((entry, index) => {
              const { question, gravity, topic, subtopic } = entry;
              const isMastered = Boolean(normalizedOralProgress.mastered[question.id]);
              return (
                <li key={question.id}>
                  <button className="oral-question-row" type="button" onClick={() => onNavigateToViewer(allEntries.map(item => item.question), "Όλες οι προηγούμενες ερωτήσεις", allEntries.indexOf(entry))}>
                    <span className="oral-question-number">{String(index + 1).padStart(3, "0")}</span>
                    <span className="oral-question-copy"><span className="oral-question-text">{question.text}</span><span className="oral-question-context">{gravity.label} · {topic.title}{subtopic ? ` · ${subtopic.title}` : ""}</span></span>
                    <span className={`oral-question-state ${isMastered ? "mastered" : ""}`} aria-label={isMastered ? "Mastered" : "Άνοιγμα"}>{isMastered ? <Icons.Check /> : <Icons.ChevronRight />}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {visibleEntries.length === 0 && <div className="crucial-empty">Δεν βρέθηκε ερώτηση για «{query}».</div>}
        </>
      )}

      {view === "bands" && !openBand && (
        <div className="oral-ladder">
          {oralData.map(gravity => {
            const questions = gravity.isTable ? [] : getOralQuestionsFromGravity(gravity);
            const summary = summarizeOralProgress(normalizedOralProgress, questions);
            return (
              <button
                key={gravity.id}
                type="button"
                className="oral-band"
                style={{ "--band": getGravityColor(gravity) }}
                onClick={() => gravity.isTable ? onNavigateToTable(gravity.rows) : setOpenBandId(gravity.id)}
              >
                <span className="oral-band-code">{gravity.label}</span>
                <span className="oral-band-main">
                  <span className="oral-band-title">{gravity.title}</span>
                </span>
                <span className="oral-band-side">
                  {!gravity.isTable && (
                    <>
                      <span className="oral-band-count">{summary.total}</span>
                      <span className="oral-band-count-label">ερωτήσεις</span>
                      <span className="oral-band-progress">{summary.mastered}/{summary.total}</span>
                    </>
                  )}
                </span>
                <span className="oral-band-go" aria-hidden="true"><Icons.ChevronRight /></span>
              </button>
            );
          })}
        </div>
      )}

      {/* One band, all of it: topics and subtopics become headings on a
          single page instead of two more rounds of clicking. */}
      {openBand && (
        <div className="oral-band-page">
          <div className="oral-band-head" style={{ "--band": getGravityColor(openBand) }}>
            <button type="button" className="nav-btn" onClick={() => setOpenBandId(null)}>
              <Icons.ChevronLeft /> Όλες οι βαρύτητες
            </button>
            <span className="oral-band-code">{openBand.label}</span>
            <span className="oral-band-head-title">{openBand.title}</span>
          </div>

          {(openBand.topics || []).map(topic => (
            <section key={topic.id} className="oral-band-topic">
              <div className="subscale">
                <h3 className="subscale-title">{topic.letter}. {topic.title}</h3>
                <span className="subscale-rule" />
                <span className="subscale-total">{renderProgressPill(getOralQuestionsFromTopic(topic))}</span>
              </div>
              {topic.description && <p className="oral-band-topic-note">{topic.description}</p>}

              {topic.subtopics
                ? topic.subtopics.map(sub => (
                    <div key={sub.id} className="oral-band-sub">
                      <h4 className="oral-band-sub-title">
                        <span className="oral-band-sub-letter">{sub.letter}.</span>
                        {sub.title}
                      </h4>
                      {renderQuestionList(
                        sub.questions,
                        `${openBand.label} ${topic.letter}.${sub.letter}. ${sub.title}`,
                        null
                      )}
                    </div>
                  ))
                : renderQuestionList(
                    topic.questions || [],
                    `${openBand.label} ${topic.letter}. ${topic.title}`,
                    null
                  )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function OralReferenceList({ title, items, tone = "default" }) {
  if (!items?.length) return null;

  return (
    <section className={`oral-reference-section ${tone}`}>
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function CrucialQuestionContent({ source }) {
  return (
    <>
      <OralReferenceList title="Άξονας ανάκλησης" items={source.recallAxis} tone="recall" />

      <section className="oral-model-answer">
        <h4>Πρότυπη προφορική απάντηση</h4>
        {source.modelAnswer.map((paragraph, index) => (
          <p key={`${source.id}-answer-${index}`}>{paragraph}</p>
        ))}
      </section>

      <OralReferenceList title="Βασικά σημεία για τις εξετάσεις" items={source.keyPoints} tone="key-points" />
      <OralReferenceList title="Συχνές παγίδες εξεταστή" items={source.examTraps} tone="traps" />

      {source.examinerQuestions?.length > 0 && (
        <section className="oral-reference-section examiner-questions">
          <h4>Ερωτήσεις εξεταστή</h4>
          {source.examinerQuestions.map((item, index) => (
            <div key={`${source.id}-eq-${index}`} className="crucial-examiner-item">
              <p className="crucial-examiner-q">{item.question}</p>
              {item.answer.map((paragraph, pIndex) => (
                <p key={`${source.id}-eq-${index}-ans-${pIndex}`} className="crucial-examiner-a">{paragraph}</p>
              ))}
            </div>
          ))}
        </section>
      )}

      {source.examVsPractice?.length > 0 && (
        <section className="oral-reference-section practice">
          <h4>Απάντηση εξετάσεων vs σύγχρονη πρακτική</h4>
          {source.examVsPractice.map((paragraph, index) => (
            <p key={`${source.id}-practice-${index}`}>{paragraph}</p>
          ))}
        </section>
      )}
    </>
  );
}

// The book runs in thematic order, so its own sequence already carries the
// chapters — these ranges name what is actually there rather than slicing the
// list into arbitrary tens. Keyed on `number`, which is a stable identifier.
const CRUCIAL_CHAPTERS = [
  { from: 1, to: 10, title: "Εκτίμηση, κίνδυνος & επείγοντα" },
  { from: 11, to: 19, title: "Σχιζοφρένεια & ψυχώσεις" },
  { from: 20, to: 27, title: "Διαταραχές διάθεσης" },
  { from: 28, to: 36, title: "Άγχος, τραύμα & σωματικά συμπτώματα" },
  { from: 37, to: 44, title: "Ουσίες & εξαρτήσεις" },
  { from: 45, to: 51, title: "Ντελίριο & νευρογνωστικές διαταραχές" },
  { from: 52, to: 58, title: "Διασυνδετική & νευροψυχιατρική" },
  { from: 59, to: 61, title: "Νευροαναπτυξιακές διαταραχές" },
  { from: 62, to: 64, title: "Διαταραχές πρόσληψης τροφής" },
  { from: 65, to: 67, title: "Ύπνος" },
  { from: 68, to: 70, title: "Διαταραχές προσωπικότητας" },
  { from: 71, to: 73, title: "Σεξουαλικότητα & φύλο" },
  { from: 74, to: 88, title: "Ψυχοφαρμακολογία" },
  { from: 89, to: 93, title: "ΗΣΘ & ψυχοθεραπείες" },
  { from: 94, to: 96, title: "Νευροεπιστήμη & γενετική" },
  { from: 97, to: 100, title: "Ειδικά θέματα" },
];

function CrucialQuestionsIndex({ onBack, onHome, onOpenQuestion }) {
  const [questions, setQuestions] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isActive = true;
    loadCrucialQuestions().then(items => {
      if (isActive) setQuestions(items);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const visibleQuestions = useMemo(() => {
    if (!questions) return [];
    const normalizedQuery = normalizeGreekSearch(query);
    if (!normalizedQuery) return questions;
    return questions.filter(question => normalizeGreekSearch(
      `${question.id} ${question.number} ${question.title}`
    ).includes(normalizedQuery));
  }, [questions, query]);

  const groups = useMemo(() => {
    if (!visibleQuestions.length) return [];
    return CRUCIAL_CHAPTERS
      .map(chapter => ({
        ...chapter,
        items: visibleQuestions.filter(q => q.number >= chapter.from && q.number <= chapter.to),
      }))
      .filter(chapter => chapter.items.length > 0);
  }, [visibleQuestions]);

  const isFiltered = query.trim().length > 0;

  return (
    <div className="crucial-index">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
      </div>

      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Προφορικά</span>
          <h2>100 Κρίσιμα Θέματα</h2>
          <span className="sheet-sub">Πρότυπες απαντήσεις, άξονες ανάκλησης και παγίδες εξεταστή</span>
        </div>
      </div>

      <div className="crucial-search">
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Αναζήτηση στα 100 θέματα…"
          aria-label="Αναζήτηση στα 100 κρίσιμα θέματα"
        />
      </div>

      {!questions ? (
        <div className="crucial-loading" role="status">Φόρτωση ευρετηρίου…</div>
      ) : (
        <>
          <div className="crucial-index-count">
            {visibleQuestions.length === questions.length
              ? `${plural(questions.length, "ερώτηση", "ερωτήσεις")}`
              : `${visibleQuestions.length} από ${plural(questions.length, "ερώτηση", "ερωτήσεις")}`}
          </div>
          {visibleQuestions.length > 0 ? (
            groups.map((chapter, chapterIndex) => (
              <div key={`${chapter.from}-${chapter.to}`}>
                {!isFiltered && (
                  <div className="subscale" style={chapterIndex === 0 ? { marginTop: 0 } : undefined}>
                    <h3 className="subscale-title">{chapter.title}</h3>
                    <span className="subscale-rule" />
                    <span className="subscale-total">{chapter.from}–{chapter.to}</span>
                  </div>
                )}
                <div className="crucial-index-list">
                  {chapter.items.map(question => (
                    <button
                      key={question.id}
                      className="crucial-index-item"
                      onClick={() => onOpenQuestion(questions, questions.indexOf(question))}
                    >
                      <span className="crucial-index-number">{question.number}</span>
                      <span className="crucial-index-title">{question.title}</span>
                      <Icons.ChevronRight />
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="crucial-empty">Δεν βρέθηκε ερώτηση για «{query}».</div>
          )}
        </>
      )}
    </div>
  );
}

function CrucialQuestionViewer({ questions, initialIndex, onBack, onHome }) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const source = questions[currentIdx];
  const total = questions.length;

  const navigate = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= total) return;
    setCurrentIdx(nextIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="oral-viewer">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Ευρετήριο
        </button>
      </div>

      <header className="crucial-viewer-heading">
        <div className="oral-viewer-meta">
          <span className="oral-source-badge">{source.id}</span>
          <span className="oral-q-counter">Ερώτηση {currentIdx + 1} / {total}</span>
        </div>
        <h2>{source.title}</h2>
      </header>

      <section className="crucial-viewer-content">
        <CrucialQuestionContent source={source} />
      </section>

      <div style={{ height: 80 }} />
      <div className="nav-bar">
        <button className="nav-btn" onClick={() => navigate(currentIdx - 1)} disabled={currentIdx === 0}>
          <Icons.ChevronLeft /> Προηγούμενη
        </button>
        <button className="nav-btn" onClick={() => navigate(currentIdx + 1)} disabled={currentIdx === total - 1}>
          Επόμενη <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}

function renderStructuredOralAnswer(text) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/).filter(Boolean);

  return paragraphs.map((para, pIdx) => {
    const lines = para.split(/\n+/).filter(Boolean);
    if (lines.length > 1) {
      return (
        <div key={pIdx} className="oral-answer-block" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+[\.\)]/.test(trimmed);
            return (
              <p key={lIdx} className={isBullet ? "oral-bullet-item" : "oral-para"}>
                {trimmed}
              </p>
            );
          })}
        </div>
      );
    }

    return (
      <p key={pIdx} className="oral-para">
        {para}
      </p>
    );
  });
}

function OralQuestionViewer({ questions, title, initialIndex = 0, oralProgress, onQuestionMastered, onBack, onHome }) {
  const [currentIdx, setCurrentIdx] = useState(() => Math.min(Math.max(0, initialIndex), questions.length - 1));
  const [showAnswer, setShowAnswer] = useState(false);
  const [showJumper, setShowJumper] = useState(false);
  const [studyMode, setStudyMode] = useState(() => {
    try {
      return localStorage.getItem("psych_oral_study_mode") === "true";
    } catch {
      return false;
    }
  });

  const q = questions[currentIdx];
  const total = questions.length;
  const normalizedOralProgress = normalizeOralProgress(oralProgress);
  const sectionSummary = summarizeOralProgress(normalizedOralProgress, questions);
  const isMastered = Boolean(normalizedOralProgress.mastered[q?.id]);
  const isAnswerVisible = studyMode || showAnswer;

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

  // Space reveals, arrows move. Recall practice works best hands-on-keyboard.
  useWindowKeydown(event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "BUTTON")
    ) {
      return;
    }
    if (event.key === " " && !studyMode) {
      event.preventDefault();
      setShowAnswer(shown => !shown);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    }
  });

  if (!q) return null;

  return (
    <div className="oral-viewer">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
      </div>

      <div className="oral-viewer-head">
        <span className="sheet-eyebrow">{title}</span>
        <div className="oral-viewer-head-side">
          <button
            type="button"
            className={`oral-mode-toggle ${studyMode ? "study" : ""}`}
            onClick={() => {
              const next = !studyMode;
              setStudyMode(next);
              try {
                localStorage.setItem("psych_oral_study_mode", String(next));
              } catch {}
            }}
            title="Εναλλαγή: Μελέτη (πάντα ανοιχτή απάντηση) vs Αυτοεξέταση (κρυφή απάντηση)"
          >
            {studyMode ? "📚 Μελέτη (Ανοιχτή)" : "🧠 Αυτοεξέταση"}
          </button>
          <ScaleStrip
            level={sectionSummary.total ? Math.round((sectionSummary.mastered / sectionSummary.total) * 5) : 0}
            label="Πρόοδος ενότητας"
          />
          <span className="plate">{sectionSummary.mastered}/{sectionSummary.total}</span>
        </div>
      </div>

      <div className="oral-q-block">
        <button
          type="button"
          className="oral-q-jumper-btn"
          onClick={() => setShowJumper(open => !open)}
          title="Πλοηγός: Άμεση μετάβαση σε οποιαδήποτε ερώτηση"
        >
          <span className="oral-q-position-now">{currentIdx + 1}</span>
          <span className="oral-q-position-total">/ {total}</span>
          <span className="oral-jumper-caret">{showJumper ? "▲" : "▼"}</span>
        </button>
        <p className="oral-q-text">{q.text}</p>
      </div>

      {showJumper && (
        <div
          className="oral-jumper-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowJumper(false)}
        >
          <div
            className="oral-jumper-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="oral-jumper-head">
              <strong>Πλοηγός Ερωτήσεων ({total})</strong>
              <button
                type="button"
                className="nav-btn"
                onClick={() => setShowJumper(false)}
              >
                Κλείσιμο
              </button>
            </div>
            <div className="oral-jumper-list">
              {questions.map((item, idx) => {
                const itemMastered = Boolean(normalizedOralProgress.mastered[item.id]);
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`oral-jumper-item ${isCurrent ? "current" : ""}`}
                    onClick={() => {
                      setCurrentIdx(idx);
                      setShowAnswer(false);
                      setShowJumper(false);
                    }}
                  >
                    <span className="oral-jumper-num">#{idx + 1}</span>
                    <span className="oral-jumper-text">{item.text}</span>
                    {itemMastered && (
                      <span style={{ color: "var(--accent)", flex: "none" }}>
                        <Icons.Check />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!isAnswerVisible ? (
        <div className="oral-answer-prompt">
          <button className="oral-answer-reveal" onClick={() => setShowAnswer(true)}>
            <Icons.Eye />
            <span className="oral-answer-reveal-label">Εμφάνιση απάντησης</span>
          </button>
          <span className="oral-answer-reveal-hint">Πρώτα δοκίμασε να απαντήσεις προφορικά.</span>
        </div>
      ) : (
        <section className="oral-answer-panel">
          <div className="oral-answer-toolbar">
            <span className="oral-answer-kicker">Απάντηση</span>
            {!studyMode && (
              <button className="oral-answer-hide" onClick={() => setShowAnswer(false)}>Απόκρυψη</button>
            )}
          </div>
          <div className="oral-quick-answer">
            {renderStructuredOralAnswer(q.answer)}
            {q.source && <div className="oral-legacy-source" style={{ marginTop: "var(--s3)", fontSize: "var(--t-meta)", color: "var(--ink-3)" }}>Συμπληρωματική πηγή: {q.source}</div>}
          </div>
        </section>
      )}

      <div className="oral-viewer-foot">
        <button className="nav-btn" onClick={goPrev} disabled={currentIdx === 0}>
          <Icons.ChevronLeft /> Προηγούμενη
        </button>
        <button
          className={`oral-mastery-toggle ${isMastered ? "mastered" : ""}`}
          aria-pressed={isMastered}
          onClick={() => onQuestionMastered(q.id, !isMastered)}
        >
          <Icons.Check />
          {isMastered ? "Κατακτημένη" : "Σήμανση ως κατακτημένη"}
        </button>
        <button className="nav-btn" onClick={goNext} disabled={currentIdx === total - 1}>
          Επόμενη <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}

const VERDICT_LABELS = {
  ready: "Επαρκώς",
  partial: "Μερικώς",
  review: "Χρειάζεται επανάληψη",
};

function OralExamSimulator({ onBack, onHome, oralProgress, onQuestionMastered, onQuestionsMastered }) {
  const [phase, setPhase] = useState("start");
  const [session, setSession] = useState([]);
  const [examinerIndex, setExaminerIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selfAssessments, setSelfAssessments] = useState({});
  const [recorded, setRecorded] = useState(false);

  const currentExaminer = session[examinerIndex];
  const currentQuestions = currentExaminer
    ? [currentExaminer.anchor, ...currentExaminer.followUps]
    : [];
  const currentQuestion = currentQuestions[questionIndex];
  const currentAssessmentKey = currentQuestion ? `${currentQuestion.id}-${examinerIndex}-${questionIndex}` : "";
  const currentAssessment = selfAssessments[currentAssessmentKey] || "";
  const askedQuestions = session.flatMap(item => [item.anchor, ...item.followUps]);
  const isAnchorQuestion = currentQuestion?.id === currentExaminer?.anchor?.id;
  const isLastQuestionForExaminer = questionIndex >= currentQuestions.length - 1;
  const isLastExaminer = examinerIndex >= session.length - 1;
  const canGoPrevious = examinerIndex > 0 || questionIndex > 0;

  // What the trainee said about their own recall, counted so the mock viva
  // produces a verdict rather than a transcript.
  const tally = session.reduce((acc, examiner, groupIndex) => {
    [examiner.anchor, ...examiner.followUps].forEach((question, index) => {
      const verdict = selfAssessments[`${question.id}-${groupIndex}-${index}`];
      if (verdict === "ready") acc.ready += 1;
      else if (verdict === "partial") acc.partial += 1;
      else if (verdict === "review") acc.review += 1;
      else acc.unrated += 1;
    });
    return acc;
  }, { ready: 0, partial: 0, review: 0, unrated: 0 });

  const startExam = () => {
    const nextSession = createOralExamSession();
    setSession(nextSession);
    setExaminerIndex(0);
    setQuestionIndex(0);
    setShowAnswer(false);
    setSelfAssessments({});
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
      <div className="oral-simulator">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
          </button>
        </div>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Προφορική Εξέταση</span>
            <h2>Ολοκλήρωση</h2>
            <span className="sheet-sub">Η αυτοαξιολόγησή σου ανά εξεταστή</span>
          </div>
        </div>

        <div className="figures">
          <div className="figure figure-pass">
            <span className="figure-value">{tally.ready}</span>
            <span className="figure-label">Επαρκώς</span>
          </div>
          <div className="figure figure-due">
            <span className="figure-value">{tally.partial}</span>
            <span className="figure-label">Μερικώς</span>
          </div>
          <div className="figure figure-mark">
            <span className="figure-value">{tally.review}</span>
            <span className="figure-label">Χρειάζεται επανάληψη</span>
          </div>
          <div className="figure">
            <span className="figure-value">{tally.unrated}</span>
            <span className="figure-label">Χωρίς αξιολόγηση</span>
          </div>
        </div>

        {session.map((examiner, groupIndex) => {
          const groupQuestions = [examiner.anchor, ...examiner.followUps];
          return (
            <div key={`examiner-${groupIndex}`}>
              <div className="subscale">
                <h3 className="subscale-title">Εξεταστής {groupIndex + 1}</h3>
                <span className="subscale-rule" />
                <span className="subscale-total">{plural(groupQuestions.length, "ερώτηση", "ερωτήσεις")}</span>
              </div>
              <div className="items">
                {groupQuestions.map((question, index) => {
                  const key = `${question.id}-${groupIndex}-${index}`;
                  const verdict = selfAssessments[key] || "";
                  const isMastered = Boolean(normalizeOralProgress(oralProgress).mastered[question.id]);
                  return (
                    <div className="item" key={key}>
                      <span className="item-num">{String(index + 1).padStart(2, "0")}</span>
                      <span className="item-body">
                        <span className="item-title">{getOralExamQuestionText(question)}</span>
                        <span className="item-meta">
                          <span>{VERDICT_LABELS[verdict] || "Χωρίς αξιολόγηση"}</span>
                        </span>
                      </span>
                      <span className="item-side">
                        <ScaleStrip
                          level={isMastered ? 1 : 0}
                          max={1}
                          label="Κατοχή"
                          onSet={next => onQuestionMastered(question.id, next === 1)}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="results-actions">
          {tally.ready > 0 && (
            <button
              className="results-btn primary"
              type="button"
              disabled={recorded}
              onClick={() => {
                const ids = [];
                session.forEach((examiner, groupIndex) => {
                  [examiner.anchor, ...examiner.followUps].forEach((question, index) => {
                    if (selfAssessments[`${question.id}-${groupIndex}-${index}`] === "ready") {
                      ids.push(question.id);
                    }
                  });
                });
                onQuestionsMastered(ids);
                setRecorded(true);
              }}
            >
              {recorded
                ? "Καταχωρίστηκαν"
                : `Καταχώρηση ${plural(tally.ready, "ερώτησης", "ερωτήσεων")} ως mastered`}
            </button>
          )}
          <button className="results-btn" onClick={startExam}>
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
      <div className="oral-simulator">
        <div className="screen-topbar">
          <button className="back-link" onClick={onBack}>
            <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
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
      <div className="oral-simulator">
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
    <div className="oral-simulator">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Επιστροφή στα Προφορικά
        </button>
      </div>

      {/* Who is asking, and what kind of question it is — the framing a real
          viva gives you before the question itself. */}
      <div className="oral-exam-frame">
        <span className="oral-exam-examiner">Εξεταστής {examinerIndex + 1}<span className="oral-exam-of"> / {session.length}</span></span>
        <span className="oral-exam-sep" aria-hidden="true" />
        <span className="oral-exam-step">Ερώτηση {questionIndex + 1} / {currentQuestions.length}</span>
        <span className={`oral-exam-kind ${isAnchorQuestion ? "anchor" : "follow"}`}>
          {isAnchorQuestion ? "Βασική" : "Follow-up"}
        </span>
      </div>

      <div className="oral-exam-context">
        {getOralExamQuestionContext(currentQuestion)}
      </div>

      <p className="oral-q-text">{getOralExamQuestionText(currentQuestion)}</p>

      {!showAnswer ? (
        <div className="oral-answer-prompt">
          <button
            type="button"
            className="oral-answer-reveal"
            onClick={() => setShowAnswer(true)}
            aria-expanded={false}
          >
            <Icons.Eye />
            <span className="oral-answer-reveal-label">Εμφάνιση ενδεικτικής απάντησης</span>
          </button>
          <span className="oral-answer-reveal-hint">Πρώτα απάντησε δυνατά, όπως στην εξέταση.</span>
        </div>
      ) : (
        <section className="oral-answer-panel">
          <div className="oral-answer-toolbar">
            <span className="oral-answer-kicker">Ενδεικτική απάντηση</span>
            <button className="oral-answer-hide" onClick={() => setShowAnswer(false)}>Απόκρυψη</button>
          </div>
          <div className="oral-quick-answer">
            {String(getOralExamQuestionAnswer(currentQuestion) || "")
              .split(/\n\n+/)
              .filter(Boolean)
              .map((paragraph, pIdx) => (
                <p key={pIdx}>{paragraph}</p>
              ))}
          </div>
        </section>
      )}

      {showAnswer && (
        <div className="oral-self-assessment">
          <span id="oral-self-assessment-label" className="oral-self-assessment-label">Πώς πήγε η ανάκληση;</span>
          <div className="oral-self-assessment-actions" role="group" aria-labelledby="oral-self-assessment-label">
            {[
              ["review", "Χρειάζεται επανάληψη"],
              ["partial", "Μερικώς"],
              ["ready", "Επαρκώς"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`oral-verdict oral-verdict-${value}`}
                aria-pressed={currentAssessment === value}
                onClick={() => setSelfAssessments(previous => ({ ...previous, [currentAssessmentKey]: value }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="nav-bar actionbar">
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
    <div className="ref-table">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
      </div>
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Προφορικά</span>
          <h2>Γρήγορες Απαντήσεις</h2>
          <span className="sheet-sub">Αριθμοί που πρέπει να ξέρεις</span>
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="ref-row">
          <span className="ref-topic">{row.topic}</span>
          <span className="ref-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

const OXFORD_CHAPTER_TITLES = {
  1: "Ψυχοπαθολογία (Συμπτώματα & Σημεία)",
  2: "Ψυχιατρική Εκτίμηση & Ιστορικό",
  3: "Διαγνωστικά Συστήματα & Ταξινόμηση",
  4: "Ηθική & Ψυχιατρική Νομοθεσία",
  5: "Νευροβιολογία & Βασικές Επιστήμες",
  6: "Εργαστηριακός Έλεγχος & Απεικόνιση",
  7: "Ψυχολογικές Αντιδράσεις & Μηχανισμοί",
  8: "Αγχώδεις Διαταραχές & ΙΨΔ",
  9: "Καταθλιπτικές Διαταραχές",
  10: "Διπολική Διαταραχή & Μανία",
  11: "Σχιζοφρένεια & Ψυχωσικές Διαταραχές",
  12: "Παραληρητικές & Παρανοϊκές Διαταραχές",
  13: "Διαταραχές Πρόσληψης Τροφής & Σωματόμορφες",
  14: "Οργανικά Ψυχικά Σύνδρομα & Ντελίριο",
  15: "Διαταραχές Προσωπικότητας",
  16: "Παιδοψυχιατρική & Εφηβεία",
  17: "Διαταραχές Διανοητικής Ανάπτυξης",
  18: "Δικαστική Ψυχιατρική",
  19: "Ψυχογηριατρική & Άνοια",
  20: "Χρήση Ουσιών & Εξαρτήσεις",
  21: "Επείγουσα Ψυχιατρική & Αυτοκτονικότητα",
  22: "Διασυνδετική Ψυχιατρική",
  23: "Διαπολιτισμική Ψυχική Υγεία",
  24: "Ψυχοθεραπείες",
  25: "Ψυχοφαρμακολογία & Σωματικές Θεραπείες",
  26: "Κοινοτική Ψυχιατρική & Υπηρεσίες",
};

const CRASH_COURSE_CHAPTER_TITLES = {
  1: "Ψυχιατρική Εκτίμηση & Ιστορικό",
  2: "Ψυχοφαρμακολογία & Σωματικές Θεραπείες",
  3: "Ψυχολογικές Θεραπείες & Μηχανισμοί Άμυνας",
  6: "Επείγουσα Ψυχιατρική & Αυτοκτονικότητα",
  7: "Οργανικά Ψυχικά Σύνδρομα & Άνοια",
  8: "Κατάχρηση Ουσιών & Αλκοόλ",
  9: "Σχιζοφρένεια & Ψυχώσεις",
  10: "Διπολική Συναισθηματική Διαταραχή",
  11: "Καταθλιπτικές Διαταραχές",
  12: "Αγχώδεις Διαταραχές & Φοβίες",
  13: "Ιδεοψυχαναγκαστική Διαταραχή",
  14: "Σωματόμορφες & Λειτουργικές Διαταραχές",
  16: "Διαταραχές Πρόσληψης Τροφής",
  20: "Εξαρτήσεις από Οπιοειδή",
  22: "Κλινική Διαχείριση Κατάθλιψης",
  24: "Σύνδρομο Επανασίτισης",
  25: "Διαταραχές Ύπνου",
  27: "Περιγεννητική Ψυχιατρική",
  30: "Παιδοψυχιατρική & Προσκόλληση",
  31: "Ψυχογηριατρική & Φαρμακοκινητική",
  32: "Δικαστική Ψυχιατρική & Επικινδυνότητα",
};

function PinakakiaModule({ onBack, onHome, routeScreen = "sources", routeChapter = null, onNavigate, referenceSources, isAdmin = false, onOpenDsm5 }) {
  const [screen, setLocalScreen] = useState(routeScreen);
  const [sourceKey, setSourceKey] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(routeChapter);
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null);

  const setScreen = useCallback((nextScreen, nextChapter = selectedChapter) => {
    setLocalScreen(nextScreen);
    onNavigate(nextScreen, nextChapter);
  }, [onNavigate, selectedChapter]);

  useEffect(() => {
    setLocalScreen(routeScreen);
    if (routeChapter !== null && routeChapter !== undefined) {
      setSelectedChapter(routeChapter);
    }
  }, [routeChapter, routeScreen]);

  useEffect(() => {
    if (routeScreen === "viewer" && !viewer) {
      onNavigate("sources", null, { replace: true });
    }
  }, [onNavigate, routeScreen, viewer]);

  const boxesForSource = useCallback(
    source => getBoxesForSource(source, referenceSources),
    [referenceSources]
  );

  const allBoxes = useMemo(() => ([
    ...boxesForSource("oxford").map(box => ({ ...box, sourceKey: "oxford" })),
    ...boxesForSource("crash").map(box => ({ ...box, sourceKey: "crash" })),
  ]), [boxesForSource]);

  const searchResults = useMemo(() => {
    const normalized = normalizeGreekSearch(query);
    if (!normalized) return [];
    return allBoxes.filter(box => getBoxSearchText(box).includes(normalized)).slice(0, 40);
  }, [allBoxes, query]);

  const oxfordChapterGroups = useMemo(() => {
    const groups = new Map();
    boxesForSource("oxford").forEach(box => {
      const chapter = Number(box.chapter) || 0;
      if (!groups.has(chapter)) groups.set(chapter, []);
      groups.get(chapter).push(box);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [boxesForSource]);

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
    setScreen("viewer");
  };

  const openRandom = (nextSourceKey, backScreen = null) => {
    const boxes = boxesForSource(nextSourceKey);
    const index = getRandomBoxIndex(boxes);
    openViewer(nextSourceKey, boxes, index, {
      randomMode: true,
      backScreen: backScreen || (nextSourceKey === "crash" ? "crash-list" : "oxford-chapters"),
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
      return;
    }

    if (screen === "oxford-chapters" || screen === "crash-list" || screen === "oxford-modes" || screen === "crash-modes") {
      setScreen("sources");
      setSourceKey(null);
      return;
    }

    if (screen === "oxford-boxes") {
      setScreen("oxford-chapters");
      return;
    }

    setScreen("sources");
  };

  const openSearchResult = (box) => {
    const nextSourceKey = box.sourceKey || getBoxSourceKey(box);
    const boxes = boxesForSource(nextSourceKey);
    const index = boxes.findIndex(item => item.id === box.id);
    openViewer(nextSourceKey, boxes, index, { backScreen: screen, backChapter: selectedChapter });
    setQuery("");
  };

  const goViewerPrev = () => {
    if (!viewer) return;
    if (viewer.randomMode) {
      if (viewer.historyIndex <= 0) return;
      const nextHistoryIndex = viewer.historyIndex - 1;
      setViewer({ ...viewer, index: viewer.history[nextHistoryIndex], historyIndex: nextHistoryIndex });
      return;
    }
    if (viewer.index <= 0) return;
    setViewer({ ...viewer, index: viewer.index - 1 });
  };

  const goViewerRandom = () => {
    if (!viewer) return;
    const boxes = boxesForSource(viewer.sourceKey);
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
  };

  const goViewerNext = () => {
    if (!viewer) return;
    if (viewer.randomMode) {
      goViewerRandom();
      return;
    }
    if (viewer.index >= viewer.boxes.length - 1) return;
    setViewer({ ...viewer, index: viewer.index + 1 });
  };

  const renderShell = (children) => {
    const hasQuery = Boolean(normalizeGreekSearch(query));
    return (
    <div className="pinakakia-screen">
      <div className="pinakakia-topbar">
        <button className="back-link" style={{ marginBottom: 0 }} onClick={handleBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
      </div>
      <div className="pinakakia-search-wrap">
        <label className="sr-only" htmlFor="pinakakia-search">Αναζήτηση σε πινακάκια</label>
        <input
          id="pinakakia-search"
          name="pinakakia-search"
          type="search"
          className="pinakakia-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Αναζήτηση σε πινακάκια…"
          autoComplete="off"
        />
      </div>
      {hasQuery && (
        <div className="pinakakia-search-summary" role="status" aria-live="polite">
          {searchResults.length ? `${searchResults.length} αποτελέσματα` : "Χωρίς αποτελέσματα"}
        </div>
      )}
      {hasQuery && (
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
      {!hasQuery && children}
    </div>
    );
  };

  if (screen === "sources") {
    const oxfordCount = boxesForSource("oxford").length;
    const crashCount = boxesForSource("crash").length;
    return renderShell(
      <>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Ενότητα</span>
            <h2>Πινακάκια</h2>
            <span className="sheet-sub">Γρήγορη αναζήτηση σε πλαίσια αναφοράς από τα δύο εγχειρίδια</span>
          </div>
        </div>
        <div className="hub-row-grid">
          <button className="hub-row" onClick={() => { setSourceKey("oxford"); setScreen("oxford-chapters"); }}>
            <span className="hub-row-icon" aria-hidden="true"><Icons.BookOpen /></span>
            <span className="hub-row-body">
              <span className="hub-row-title">Oxford</span>
              <span className="hub-row-stat">{plural(oxfordCount, "πινακάκιο", "πινακάκια")}</span>
            </span>
            <span className="hub-row-go" aria-hidden="true"><Icons.ChevronRight /></span>
          </button>
          <button className="hub-row" onClick={() => { setSourceKey("crash"); setScreen("crash-list"); }}>
            <span className="hub-row-icon" aria-hidden="true"><Icons.FileText /></span>
            <span className="hub-row-body">
              <span className="hub-row-title">Crash Course</span>
              <span className="hub-row-stat">{plural(crashCount, "πινακάκιο", "πινακάκια")}</span>
            </span>
            <span className="hub-row-go" aria-hidden="true"><Icons.ChevronRight /></span>
          </button>
          {isAdmin && (
            <button className="hub-row" onClick={() => onOpenDsm5?.()}>
              <span className="hub-row-icon" aria-hidden="true"><Icons.Table /></span>
              <span className="hub-row-body">
                <span className="hub-row-title">DSM-5-TR Self-Exam (Admin)</span>
                <span className="hub-row-stat">528 ερωτήσεις</span>
              </span>
              <span className="hub-row-go" aria-hidden="true"><Icons.ChevronRight /></span>
            </button>
          )}
        </div>
      </>
    );
  }

  if (screen === "oxford-chapters" || screen === "oxford-modes") {
    const boxes = boxesForSource("oxford");
    return renderShell(
      <>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Oxford Handbook</span>
            <h2>Κεφάλαια</h2>
            <span className="sheet-sub">{oxfordChapterGroups.length} κεφάλαια · {plural(boxes.length, "πινακάκιο", "πινακάκια")}</span>
          </div>
        </div>
        <div className="items">
          {oxfordChapterGroups.map(([chapter, chapterBoxes]) => {
            const title = OXFORD_CHAPTER_TITLES[chapter] || `Κεφάλαιο ${chapter}`;
            return (
              <button
                key={chapter}
                className="item"
                onClick={() => {
                  setSelectedChapter(chapter);
                  setScreen("oxford-boxes", chapter);
                }}
              >
                <span className="item-num">{String(chapter).padStart(2, "0")}</span>
                <span className="item-body">
                  <span className="item-title">{title}</span>
                  <span className="item-meta">
                    <span>Κεφάλαιο {chapter}</span>
                    <span>·</span>
                    <span>{plural(chapterBoxes.length, "πινακάκιο", "πινακάκια")}</span>
                  </span>
                </span>
                <span className="item-side">
                  <span style={{ color: "var(--ink-3)", display: "flex" }} aria-hidden="true"><Icons.ChevronRight /></span>
                </span>
              </button>
            );
          })}
        </div>
        {!oxfordChapterGroups.length && <div className="pinakakia-empty">Δεν έχουν προστεθεί ακόμα κεφάλαια.</div>}
      </>
    );
  }

  if (screen === "oxford-boxes") {
    const boxes = boxesForSource("oxford").filter(box => Number(box.chapter) === Number(selectedChapter));
    const chapterName = OXFORD_CHAPTER_TITLES[selectedChapter];
    return renderShell(
      <>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Oxford · Κεφάλαιο {selectedChapter}{chapterName ? `: ${chapterName}` : ""}</span>
            <h2>{plural(boxes.length, "πινακάκιο", "πινακάκια")}</h2>
          </div>
        </div>
        <div className="items">
          {boxes.map((box, index) => (
            <button
              key={box.id}
              className="item"
              onClick={() => openViewer("oxford", boxes, index, { backScreen: "oxford-boxes", backChapter: selectedChapter })}
            >
              <span className="item-num">{box.boxNumber}</span>
              <span className="item-body">
                <span className="item-title">{box.title}</span>
                {box.page && <span className="item-meta"><span>pg. {box.page}</span></span>}
              </span>
              <span className="item-side">
                <span style={{ color: "var(--ink-3)", display: "flex" }} aria-hidden="true"><Icons.ChevronRight /></span>
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (screen === "crash-list" || screen === "crash-modes") {
    const boxes = boxesForSource("crash");
    return renderShell(
      <>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <span className="sheet-eyebrow">Crash Course</span>
            <h2>Πινακάκια Αναφοράς</h2>
            <span className="sheet-sub">{plural(boxes.length, "πινακάκιο", "πινακάκια")}</span>
          </div>
        </div>
        <div className="items">
          {boxes.map((box, index) => {
            const chapterTitle = CRASH_COURSE_CHAPTER_TITLES[box.chapter];
            return (
              <button
                key={box.id}
                className="item"
                onClick={() => openViewer("crash", boxes, index, { backScreen: "crash-list" })}
              >
                <span className="item-num">{box.boxNumber}</span>
                <span className="item-body">
                  <span className="item-title">{box.title}</span>
                  <span className="item-meta">
                    {box.chapter && <span>Κεφ. {box.chapter}{chapterTitle ? `: ${chapterTitle}` : ""}</span>}
                    {box.page && <span>pg. {box.page}</span>}
                  </span>
                </span>
                <span className="item-side">
                  <span style={{ color: "var(--ink-3)", display: "flex" }} aria-hidden="true"><Icons.ChevronRight /></span>
                </span>
              </button>
            );
          })}
        </div>
        {!boxes.length && <div className="pinakakia-empty">Δεν έχουν προστεθεί ακόμα πινακάκια.</div>}
      </>
    );
  }

  if (screen === "viewer" && viewer) {
    const box = viewer.boxes[viewer.index];
    const canGoPrev = viewer.randomMode ? viewer.historyIndex > 0 : viewer.index > 0;
    const canGoNext = viewer.randomMode || viewer.index < viewer.boxes.length - 1;
    const contentLines = getBoxContentLines(box.content, viewer.sourceKey);
    const chapterName = viewer.sourceKey === "oxford"
      ? OXFORD_CHAPTER_TITLES[box.chapter]
      : CRASH_COURSE_CHAPTER_TITLES[box.chapter];

    return renderShell(
      <div className="pinakakia-viewer">
        <div className="pinakakia-viewer-meta">
          <span>{box.source || sourceLabel}</span>
          <span>Box {box.boxNumber}</span>
          {box.chapter && <span>Κεφάλαιο {box.chapter}{chapterName ? ` (${chapterName})` : ""}</span>}
          {box.page && <span>pg. {box.page}</span>}
        </div>
        <div className={`pinakakia-book-box ${viewer.sourceKey}`}>
          <div className="pinakakia-book-header">
            <span className="pinakakia-book-header-num">Box {box.boxNumber}</span>
            <span className="pinakakia-book-header-title">{box.title}</span>
            {box.page && <span className="pinakakia-book-header-page">pg. {box.page}</span>}
          </div>
          <div className="pinakakia-book-body">
            <div className="pinakakia-content-text">
              {contentLines.map((line, index) => {
                const indent = line.indentLevel || 0;
                const style = indent ? { paddingLeft: `${indent * 18}px` } : undefined;
                let cls = "pinakakia-content-line";
                if (line.kind === "heading") cls += " heading";
                else if (line.kind === "subsection-heading") cls += " subsection-heading";
                else cls += " entry";
                return (
                  <div className={cls} style={style} key={`${box.id}-line-${index}`}>
                    <span dangerouslySetInnerHTML={{ __html: line.text }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

function SosHome({ data, onBack, onHome, onOpenSection, sosProgress }) {
  const sections = [
    {
      id: "highyield",
      icon: <Icons.Bolt />,
      title: "Γρήγορα SOS",
      section: "high_yield",
      entries: data?.highYieldTables,
    },
    {
      id: "numbers",
      icon: <Icons.FileText />,
      title: "Αριθμοί",
      section: "numbers",
      entries: data?.numbers,
    },
    {
      id: "critical",
      icon: <Icons.Brain />,
      title: "Κρίσιμα Θέματα",
      section: "critical_topics",
      entries: data?.criticalTopics,
    },
    {
      id: "differential",
      icon: <Icons.Globe />,
      title: "Διαφοροδιάγνωση",
      section: "differential_diagnosis",
      entries: data?.differentialDiagnosis,
    },
  ];

  const overallTotal = sections.reduce((sum, s) => sum + (s.entries?.length || 0), 0);
  const overallMastered = sections.reduce((sum, s) => {
    if (!sosProgress) return sum;
    return sum + summarizeSosProgress(sosProgress, s.section, s.entries || []).mastered;
  }, 0);

  return (
    <div className="sos-screen">
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">Ενότητα</span>
          <h2>SOS</h2>
          <span className="sheet-sub">Γρήγορη ανάκληση λίγο πριν την εξέταση</span>
        </div>
        <div className="sheet-head-actions">
          <span className="plate">{overallMastered}/{overallTotal} mastered</span>
        </div>
      </div>

      <div className="hub-row-grid">
        {sections.map(section => {
          const total = section.entries?.length || 0;
          const summary = sosProgress
            ? summarizeSosProgress(sosProgress, section.section, section.entries || [])
            : null;
          const mastered = summary?.mastered || 0;
          return (
            <button key={section.id} className="hub-row" onClick={() => onOpenSection(section.id)}>
              <span className="hub-row-icon" aria-hidden="true">{section.icon}</span>
              <span className="hub-row-body">
                <span className="hub-row-title">{section.title}</span>
                <span className="hub-row-stat">{mastered}/{total} mastered</span>
              </span>
              <span className="hub-row-go" aria-hidden="true"><Icons.ChevronRight /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function highlightNumbersAndUnits(text) {
  if (!text) return text;
  const parts = String(text).split(/((?:≥|≤|>|<|=)?\s*\d+(?:[\.,]\d+)?(?:\s*[-–—]\s*\d+(?:[\.,]\d+)?)?\s*(?:mg(?:\/day|\/d)?|mEq\/L|μg\/L|ng\/mL|mg\/dL|mm³|ms|%|έτη|εβδομάδες|μήνες|ημέρες|ώρες|kg|BMI)?\b)/g);

  if (parts.length <= 1) return text;

  return parts.map((part, i) => {
    if (/\d+/.test(part) && /(?:mg|mEq|μg|ng|mm³|ms|%|έτη|εβδομάδες|μήνες|ημέρες|ANC|QTc|BMI|≥|≤|>|<)/i.test(part)) {
      return <span key={i} className="sos-number-mark">{part}</span>;
    }
    return part;
  });
}

function renderStructuredSosContent(text) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/).filter(Boolean);

  return paragraphs.map((para, pIdx) => {
    const lines = para.split(/\n+/).filter(Boolean);
    if (lines.length > 1) {
      return (
        <div key={pIdx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+[\.\)]/.test(trimmed);
            return (
              <p key={lIdx} className={isBullet ? "oral-bullet-item" : "oral-para"} style={{ margin: 0 }}>
                {highlightNumbersAndUnits(trimmed)}
              </p>
            );
          })}
        </div>
      );
    }

    return (
      <p key={pIdx} className="oral-para" style={{ margin: 0 }}>
        {highlightNumbersAndUnits(para)}
      </p>
    );
  });
}

function SosHighYieldTables({ tables, sosProgress, onToggleMastery, onBack, onHome }) {
  const [shuffledTables, setShuffledTables] = useState(() => shuffleItems(tables));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMastered, setShowMastered] = useState(false);
  const [showJumper, setShowJumper] = useState(false);
  const [studyMode, setStudyMode] = useState(() => {
    try {
      return localStorage.getItem("psych_sos_study_mode") === "true";
    } catch {
      return false;
    }
  });

  const mastered = normalizeSosProgress(sosProgress).mastered.high_yield || {};
  const summary = summarizeSosProgress(sosProgress, "high_yield", tables);
  const visibleTables = useMemo(
    () => showMastered ? shuffledTables : shuffledTables.filter(item => !mastered[item.id]),
    [mastered, showMastered, shuffledTables]
  );
  const entry = visibleTables[currentIndex];
  const isAnswerVisible = studyMode || showAnswer;

  useEffect(() => {
    if (currentIndex >= visibleTables.length) setCurrentIndex(Math.max(0, visibleTables.length - 1));
  }, [currentIndex, visibleTables.length]);

  const navigate = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= visibleTables.length) return;
    setCurrentIndex(nextIndex);
    setShowAnswer(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reshuffle = () => {
    setShuffledTables(current => shuffleItems(current));
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const toggleCurrentMastery = (nextMastered) => {
    if (!entry) return;
    onToggleMastery("high_yield", entry.id, nextMastered);
    setShowAnswer(false);
  };

  useWindowKeydown(event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "BUTTON")
    ) {
      return;
    }
    if (event.key === " " && !studyMode) {
      event.preventDefault();
      setShowAnswer(shown => !shown);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      navigate(currentIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(currentIndex - 1);
    }
  });

  return (
    <div className="sos-screen">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> SOS
        </button>
      </div>
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">SOS</span>
          <h2>Γρήγορα SOS</h2>
        </div>
      </div>
      <div className="sos-focus-toolbar">
        <div className="sos-focus-toggles">
          <button
            type="button"
            className={`oral-mode-toggle ${studyMode ? "study" : ""}`}
            onClick={() => {
              const next = !studyMode;
              setStudyMode(next);
              try {
                localStorage.setItem("psych_sos_study_mode", String(next));
              } catch {}
            }}
            title="Εναλλαγή λειτουργίας: Μελέτη (ανοιχτή) vs Αυτοεξέταση (κρυφή)"
          >
            {studyMode ? "📚 Μελέτη (Ανοιχτή)" : "🧠 Αυτοεξέταση"}
          </button>
          <label className="sos-check-control">
            <input type="checkbox" checked={showMastered} onChange={event => { setShowMastered(event.target.checked); setCurrentIndex(0); setShowAnswer(false); }} />
            Εμφάνιση mastered
          </label>
          <span className="oral-progress-pill">{summary.mastered}/{summary.total} mastered</span>
        </div>
        <button className="sos-shuffle-btn" type="button" onClick={reshuffle}>Ανακάτεμα</button>
      </div>

      {showJumper && (
        <div className="oral-jumper-overlay" role="dialog" aria-modal="true" onClick={() => setShowJumper(false)}>
          <div className="oral-jumper-card" onClick={e => e.stopPropagation()}>
            <div className="oral-jumper-head">
              <strong>Πλοηγός Καρτών SOS ({visibleTables.length})</strong>
              <button type="button" className="nav-btn" onClick={() => setShowJumper(false)}>Κλείσιμο</button>
            </div>
            <div className="oral-jumper-list">
              {visibleTables.map((item, idx) => {
                const isItemMastered = Boolean(mastered[item.id]);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`oral-jumper-item ${isCurrent ? "current" : ""}`}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowAnswer(false);
                      setShowJumper(false);
                    }}
                  >
                    <span className="oral-jumper-num">#{idx + 1}</span>
                    <span className="oral-jumper-text">{item.prompt}</span>
                    {isItemMastered && <span style={{ color: "var(--accent)", flex: "none" }}><Icons.Check /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!entry ? (
        <div className="sos-focus-empty">
          <strong>Όλες οι κάρτες έχουν κατακτηθεί.</strong>
          <span>Ενεργοποίησε την εμφάνιση mastered για επανάληψη.</span>
        </div>
      ) : <>
      <div className="sos-focus-meta">
        <button
          type="button"
          className="oral-q-jumper-btn"
          onClick={() => setShowJumper(open => !open)}
          title="Άμεση μετάβαση σε οποιαδήποτε κάρτα"
        >
          <span>Κάρτα {currentIndex + 1} / {visibleTables.length}</span>
          <span className="oral-jumper-caret">▼</span>
        </button>
        <span style={{ fontSize: "var(--t-micro)" }}>{isAnswerVisible ? "Απάντηση" : "Ερώτηση"}</span>
      </div>
      <section className="sos-focus-card" aria-live="polite">
        <div className="sos-card-kicker">Ερώτηση</div>
        <div className="sos-focus-prompt">{entry.prompt}</div>
        {isAnswerVisible ? (
          <div className="sos-focus-answer">
            {renderStructuredSosContent(entry.answer)}
          </div>
        ) : (
          <button className="sos-focus-reveal" type="button" onClick={() => setShowAnswer(true)}>Εμφάνιση απάντησης</button>
        )}
        <label className={`sos-check-control ${mastered[entry.id] ? "mastered" : ""}`}>
          <input type="checkbox" checked={Boolean(mastered[entry.id])} onChange={event => toggleCurrentMastery(event.target.checked)} />
          Mastered
        </label>
      </section>
      <div className="sos-focus-nav">
        <button type="button" className="nav-btn" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0}><Icons.ChevronLeft /> Προηγούμενη</button>
        <button type="button" className="nav-btn" onClick={() => navigate(currentIndex + 1)} disabled={currentIndex === visibleTables.length - 1}>Επόμενη <Icons.ChevronRight /></button>
      </div>
      </>}
    </div>
  );
}

function parseDifferential(answer, title) {
  const result = {
    title,
    axisTitle: 'Κεντρικός Άξονας Διάκρισης',
    axisContent: '',
    comparisonTitle: 'Συγκριτική Ανάλυση',
    comparisonBlocks: [],
    treatmentTitle: null,
    treatmentContent: '',
    trap: null,
    keyPhrase: null,
  };

  const sections = answer.split('\n\n').map(s => s.trim()).filter(Boolean);

  for (const sec of sections) {
    if (sec.startsWith('Κεντρικός Άξονας Διάκρισης:')) {
      result.axisContent = sec.replace(/^Κεντρικός Άξονας Διάκρισης:\s*/, '').trim();
    } else if (sec.startsWith('Εξεταστική Φράση-Κλειδί:')) {
      result.keyPhrase = sec.replace(/^Εξεταστική Φράση-Κλειδί:\s*/, '').trim();
    } else if (sec.startsWith('Εξεταστική Παγίδα:')) {
      result.trap = sec.replace(/^Εξεταστική Παγίδα:\s*/, '').trim();
    } else if (sec.startsWith('Θεραπευτική Αντιπαραβολή:') || sec.startsWith('Θεραπευτική Σημασία:')) {
      const firstLineEnd = sec.indexOf('\n');
      if (firstLineEnd !== -1) {
        result.treatmentTitle = sec.slice(0, firstLineEnd).replace(/:$/, '').trim();
        result.treatmentContent = sec.slice(firstLineEnd + 1).trim();
      } else {
        result.treatmentTitle = sec.replace(/:$/, '').trim();
      }
    } else {
      const firstLineEnd = sec.indexOf('\n');
      if (firstLineEnd !== -1 && (sec.startsWith('Συγκριτικ') || sec.startsWith('Διαγνωστικ') || sec.startsWith('Διαφοροδιαγνωστικ') || sec.startsWith('Ενδείξεις'))) {
        result.comparisonTitle = sec.slice(0, firstLineEnd).replace(/:$/, '').trim();
        const body = sec.slice(firstLineEnd + 1).trim();
        result.comparisonBlocks = parseComparisonItems(body);
      } else {
        result.comparisonBlocks = parseComparisonItems(sec);
      }
    }
  }

  return result;
}

function parseComparisonItems(text) {
  const items = [];
  const lines = text.split('\n');
  let currentItem = null;

  for (const line of lines) {
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (currentItem) items.push(currentItem);
      currentItem = {
        num: numMatch[1],
        header: numMatch[2],
        bullets: [],
        rawLines: []
      };
    } else if (currentItem) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        currentItem.bullets.push(trimmed.replace(/^[-•]\s*/, ''));
      } else if (trimmed) {
        currentItem.rawLines.push(trimmed);
      }
    } else {
      const trimmed = line.trim();
      if (trimmed) {
        items.push({ num: '', header: trimmed, bullets: [], rawLines: [] });
      }
    }
  }
  if (currentItem) items.push(currentItem);
  return items;
}

function DifferentialDiagnosisCard({ entry }) {
  const [viewMode, setViewMode] = useState("compare");
  const parsed = useMemo(() => parseDifferential(entry.answer, entry.title), [entry.answer, entry.title]);
  const entities = useMemo(() => entry.title.split(/\s+vs\s+/i), [entry.title]);

  return (
    <div className="diff-view">
      <div className="diff-entities-bar">
        <span className="diff-entities-label">Σύγκριση:</span>
        <div className="diff-entities-list">
          {entities.map((name, i) => (
            <span key={i} className={`diff-entity-tag diff-tag-${i % 4}`}>
              {name.trim()}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "var(--s1)" }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "compare" ? "primary" : "btn-quiet"}`}
            style={{ padding: "4px 10px", fontSize: "var(--t-micro)", minHeight: 30 }}
            onClick={() => setViewMode("compare")}
          >
            <Icons.Columns /> Σύγκριση
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "text" ? "primary" : "btn-quiet"}`}
            style={{ padding: "4px 10px", fontSize: "var(--t-micro)", minHeight: 30 }}
            onClick={() => setViewMode("text")}
          >
            <Icons.FileText /> Κείμενο
          </button>
        </div>
      </div>

      {viewMode === "text" ? (
        <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--read)", fontSize: 15, lineHeight: 1.7, marginTop: "var(--s3)" }}>
          {entry.answer}
        </div>
      ) : (
        <>
          {parsed.axisContent && (
            <section className="diff-section diff-axis-card">
              <div className="diff-card-kicker">
                <Icons.Target /> {parsed.axisTitle}
              </div>
              <div className="diff-axis-text">
                {parsed.axisContent.split('\n').map((line, idx) => {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                    return (
                      <div key={idx} className="diff-axis-bullet">
                        <span className="diff-bullet-dot" aria-hidden="true" />
                        <span>{trimmed.replace(/^[-•]\s*/, '')}</span>
                      </div>
                    );
                  }
                  return <p key={idx} style={{ margin: 0 }}>{trimmed}</p>;
                })}
              </div>
            </section>
          )}

          <section className="diff-section">
            <div className="diff-section-header">
              <Icons.Columns />
              <h3>{parsed.comparisonTitle}</h3>
            </div>
            <div className="diff-grid">
              {parsed.comparisonBlocks.map((block, idx) => {
                const hasColon = block.header.includes(':');
                const [headline, ...restHeader] = hasColon ? block.header.split(':') : [block.header, ''];
                const subtitle = restHeader.join(':').trim();

                return (
                  <div key={idx} className={`diff-column-card diff-col-${idx % 4}`}>
                    <div className="diff-column-header">
                      <span className="diff-column-badge">
                        {block.num ? `${block.num}` : (idx + 1)}
                      </span>
                      <div className="diff-column-title-wrap">
                        <h4 className="diff-column-title">{headline.trim()}</h4>
                        {subtitle && <span className="diff-column-subtitle">{subtitle}</span>}
                      </div>
                    </div>
                    <div className="diff-column-body">
                      {block.bullets.length > 0 ? (
                        <ul className="diff-bullet-list">
                          {block.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="diff-bullet-item">
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {block.rawLines.map((line, rIdx) => (
                        <p key={rIdx} className="diff-raw-line">{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {parsed.treatmentTitle && (
            <section className="diff-section diff-treatment-card">
              <div className="diff-card-kicker">
                <Icons.Zap /> {parsed.treatmentTitle}
              </div>
              <div className="diff-treatment-body">
                {parsed.treatmentContent.split('\n').map((line, idx) => {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                    return (
                      <div key={idx} className="diff-treatment-row">
                        <span>{trimmed.replace(/^[-•]\s*/, '')}</span>
                      </div>
                    );
                  }
                  return <p key={idx} style={{ margin: 0 }}>{trimmed}</p>;
                })}
              </div>
            </section>
          )}

          {parsed.trap && (
            <div className="diff-trap-card">
              <div className="diff-trap-kicker">
                <Icons.AlertTriangle /> Εξεταστική Παγίδα
              </div>
              <p className="diff-trap-text">{parsed.trap}</p>
            </div>
          )}

          {parsed.keyPhrase && (
            <div className="diff-key-card">
              <div className="diff-key-kicker">
                <Icons.Key /> Εξεταστική Φράση-Κλειδί
              </div>
              <blockquote className="diff-key-quote">
                {parsed.keyPhrase}
              </blockquote>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SosEntrySection({ title, section, entries, sosProgress, onToggleMastery, onBack, onHome, renderAnswer = null, searchNoun = ["καταχώρηση", "καταχωρήσεις"], countNoun = ["καταχώρηση", "καταχωρήσεις"] }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "flashcards"
  const [drillIndex, setDrillIndex] = useState(0);
  const [showDrillAnswer, setShowDrillAnswer] = useState(false);
  const [shuffledEntries, setShuffledEntries] = useState(() => entries);
  const [showMasteredInDrill, setShowMasteredInDrill] = useState(true);
  const [showJumper, setShowJumper] = useState(false);
  const [studyMode, setStudyMode] = useState(() => {
    try {
      return localStorage.getItem("psych_sos_study_mode") === "true";
    } catch {
      return false;
    }
  });

  const normalizedProgress = normalizeSosProgress(sosProgress);
  const mastered = normalizedProgress.mastered[section] || {};
  const summary = summarizeSosProgress(normalizedProgress, section, entries);
  const selectedEntry = Number.isInteger(selectedIndex) ? entries[selectedIndex] : null;

  const drillList = useMemo(() => {
    return showMasteredInDrill
      ? shuffledEntries
      : shuffledEntries.filter(item => !mastered[item.id]);
  }, [mastered, showMasteredInDrill, shuffledEntries]);

  const currentDrillEntry = drillList[drillIndex] || drillList[0];
  const isDrillAnswerVisible = studyMode || showDrillAnswer;

  useEffect(() => {
    if (drillIndex >= drillList.length) setDrillIndex(Math.max(0, drillList.length - 1));
  }, [drillIndex, drillList.length]);

  const reshuffleDrill = () => {
    setShuffledEntries(shuffleItems(entries));
    setDrillIndex(0);
    setShowDrillAnswer(false);
  };

  const navigateDrill = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= drillList.length) return;
    setDrillIndex(nextIndex);
    setShowDrillAnswer(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDrillMastery = (nextMastered) => {
    if (!currentDrillEntry) return;
    onToggleMastery(section, currentDrillEntry.id, nextMastered);
  };

  // Keep the original index so numbering and prev/next stay stable while filtering.
  const visibleEntries = useMemo(() => {
    const normalized = normalizeGreekSearch(query);
    const indexed = entries.map((entry, index) => ({ entry, index }));
    if (!normalized) return indexed;
    return indexed.filter(({ entry }) =>
      normalizeGreekSearch(`${entry.title} ${entry.answer || ""}`).includes(normalized)
    );
  }, [entries, query]);

  const goPrev = () => setSelectedIndex(index => Math.max(0, index - 1));
  const goNext = () => setSelectedIndex(index => Math.min(entries.length - 1, index + 1));

  useWindowKeydown(event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "BUTTON")
    ) {
      return;
    }
    if (selectedEntry) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    } else if (viewMode === "flashcards") {
      if (event.key === " " && !studyMode) {
        event.preventDefault();
        setShowDrillAnswer(shown => !shown);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateDrill(drillIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateDrill(drillIndex - 1);
      }
    }
  });

  if (selectedEntry) {
    const isMastered = Boolean(mastered[selectedEntry.id]);
    return (
      <div className="sos-screen">
        <div className="screen-topbar">
          <button className="back-link" onClick={() => setSelectedIndex(null)}>
            <Icons.ChevronLeft /> {title}
          </button>
        </div>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <button
              type="button"
              className="oral-q-jumper-btn"
              style={{ marginBottom: "var(--s2)" }}
              onClick={() => setShowJumper(open => !open)}
              title="Άμεση μετάβαση σε οποιοδήποτε θέμα"
            >
              <span>{title} · {selectedIndex + 1} / {entries.length}</span>
              <span className="oral-jumper-caret">▼</span>
            </button>
            <h2>{selectedEntry.title}</h2>
          </div>
          <div className="sheet-head-actions">
            <span className="plate">{summary.mastered}/{summary.total} mastered</span>
          </div>
        </div>

        {showJumper && (
          <div className="oral-jumper-overlay" role="dialog" aria-modal="true" onClick={() => setShowJumper(false)}>
            <div className="oral-jumper-card" onClick={e => e.stopPropagation()}>
              <div className="oral-jumper-head">
                <strong>Πλοηγός: {title} ({entries.length})</strong>
                <button type="button" className="nav-btn" onClick={() => setShowJumper(false)}>Κλείσιμο</button>
              </div>
              <div className="oral-jumper-list">
                {entries.map((item, idx) => {
                  const isItemMastered = Boolean(mastered[item.id]);
                  const isCurrent = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`oral-jumper-item ${isCurrent ? "current" : ""}`}
                      onClick={() => {
                        setSelectedIndex(idx);
                        setShowJumper(false);
                      }}
                    >
                      <span className="oral-jumper-num">#{idx + 1}</span>
                      <span className="oral-jumper-text">{item.title}</span>
                      {isItemMastered && <span style={{ color: "var(--accent)", flex: "none" }}><Icons.Check /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <button
          className={`oral-mastery-toggle ${isMastered ? "mastered" : ""}`}
          aria-pressed={isMastered}
          onClick={() => onToggleMastery(section, selectedEntry.id, !isMastered)}
        >
          <Icons.Check />
          {isMastered ? "Κατακτημένο" : "Σημείωσέ το ως κατακτημένο"}
        </button>
        <div className="sos-detail-answer">
          {renderAnswer ? renderAnswer(selectedEntry) : renderStructuredSosContent(selectedEntry.answer)}
        </div>
        <div className="nav-bar actionbar">
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
    <div className="sos-screen">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> SOS
        </button>
      </div>
      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">SOS</span>
          <h2>{title}</h2>
        </div>
        <div className="sheet-head-actions">
          <span className="plate">{summary.mastered}/{summary.total} mastered</span>
        </div>
      </div>

      <div className="diff-entities-bar" style={{ marginBottom: "var(--s4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="diff-entities-label">Λειτουργία Προβολής:</span>
        <div style={{ display: "flex", gap: "var(--s1)" }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "list" ? "primary" : "btn-quiet"}`}
            style={{ padding: "4px 10px", fontSize: "var(--t-micro)", minHeight: 30 }}
            onClick={() => setViewMode("list")}
          >
            <Icons.Table /> Λίστα
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "flashcards" ? "primary" : "btn-quiet"}`}
            style={{ padding: "4px 10px", fontSize: "var(--t-micro)", minHeight: 30 }}
            onClick={() => { setViewMode("flashcards"); setDrillIndex(0); setShowDrillAnswer(false); }}
          >
            <Icons.Bolt /> Flashcards
          </button>
        </div>
      </div>

      {viewMode === "flashcards" ? (
        <>
          <div className="sos-focus-toolbar">
            <div className="sos-focus-toggles">
              <button
                type="button"
                className={`oral-mode-toggle ${studyMode ? "study" : ""}`}
                onClick={() => {
                  const next = !studyMode;
                  setStudyMode(next);
                  try {
                    localStorage.setItem("psych_sos_study_mode", String(next));
                  } catch {}
                }}
                title="Εναλλαγή: Μελέτη (ανοιχτή) vs Αυτοεξέταση (κρυφή)"
              >
                {studyMode ? "📚 Μελέτη (Ανοιχτή)" : "🧠 Αυτοεξέταση"}
              </button>
              <label className="sos-check-control">
                <input type="checkbox" checked={showMasteredInDrill} onChange={event => { setShowMasteredInDrill(event.target.checked); setDrillIndex(0); setShowDrillAnswer(false); }} />
                Εμφάνιση mastered
              </label>
              <span className="oral-progress-pill">{summary.mastered}/{summary.total} mastered</span>
            </div>
            <button className="sos-shuffle-btn" type="button" onClick={reshuffleDrill}>Ανακάτεμα</button>
          </div>

          {showJumper && (
            <div className="oral-jumper-overlay" role="dialog" aria-modal="true" onClick={() => setShowJumper(false)}>
              <div className="oral-jumper-card" onClick={e => e.stopPropagation()}>
                <div className="oral-jumper-head">
                  <strong>Πλοηγός Flashcards ({drillList.length})</strong>
                  <button type="button" className="nav-btn" onClick={() => setShowJumper(false)}>Κλείσιμο</button>
                </div>
                <div className="oral-jumper-list">
                  {drillList.map((item, idx) => {
                    const isItemMastered = Boolean(mastered[item.id]);
                    const isCurrent = idx === drillIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`oral-jumper-item ${isCurrent ? "current" : ""}`}
                        onClick={() => {
                          setDrillIndex(idx);
                          setShowDrillAnswer(false);
                          setShowJumper(false);
                        }}
                      >
                        <span className="oral-jumper-num">#{idx + 1}</span>
                        <span className="oral-jumper-text">{item.title}</span>
                        {isItemMastered && <span style={{ color: "var(--accent)", flex: "none" }}><Icons.Check /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!currentDrillEntry ? (
            <div className="sos-focus-empty">
              <strong>Όλες οι κάρτες έχουν κατακτηθεί.</strong>
              <span>Ενεργοποίησε την εμφάνιση mastered για επανάληψη.</span>
            </div>
          ) : (
            <>
              <div className="sos-focus-meta">
                <button
                  type="button"
                  className="oral-q-jumper-btn"
                  onClick={() => setShowJumper(open => !open)}
                  title="Άμεση μετάβαση σε οποιαδήποτε κάρτα"
                >
                  <span>Κάρτα {drillIndex + 1} / {drillList.length}</span>
                  <span className="oral-jumper-caret">▼</span>
                </button>
                <span style={{ fontSize: "var(--t-micro)" }}>{isDrillAnswerVisible ? "Απάντηση" : "Ερώτηση / Θέμα"}</span>
              </div>
              <section className="sos-focus-card" aria-live="polite">
                <div className="sos-card-kicker">{title}</div>
                <div className="sos-focus-prompt" style={{ fontWeight: 700 }}>{currentDrillEntry.title}</div>
                {isDrillAnswerVisible ? (
                  <div className="sos-focus-answer">
                    {renderAnswer ? renderAnswer(currentDrillEntry) : renderStructuredSosContent(currentDrillEntry.answer)}
                  </div>
                ) : (
                  <button className="sos-focus-reveal" type="button" onClick={() => setShowDrillAnswer(true)}>
                    Εμφάνιση ανάλυσης
                  </button>
                )}
                <label className={`sos-check-control ${mastered[currentDrillEntry.id] ? "mastered" : ""}`}>
                  <input type="checkbox" checked={Boolean(mastered[currentDrillEntry.id])} onChange={event => toggleDrillMastery(event.target.checked)} />
                  Mastered
                </label>
              </section>
              <div className="sos-focus-nav">
                <button type="button" className="nav-btn" onClick={() => navigateDrill(drillIndex - 1)} disabled={drillIndex === 0}>
                  <Icons.ChevronLeft /> Προηγούμενη
                </button>
                <button type="button" className="nav-btn" onClick={() => navigateDrill(drillIndex + 1)} disabled={drillIndex === drillList.length - 1}>
                  Επόμενη <Icons.ChevronRight />
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="oral-index-controls">
            <div className="oral-search">
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={`Αναζήτηση σε ${plural(entries.length, searchNoun[0], searchNoun[1])}…`}
                aria-label={`Αναζήτηση σε ${title}`}
              />
            </div>
            <div className="oral-index-count">
              {visibleEntries.length === entries.length
                ? plural(entries.length, countNoun[0], countNoun[1])
                : `${visibleEntries.length} από ${plural(entries.length, countNoun[0], countNoun[1])}`}
            </div>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="state">
              <span className="state-title">Καμία αντιστοίχιση</span>
              <span className="state-body">Δεν βρέθηκε καταχώρηση για «{query}».</span>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setQuery("")}>
                Καθαρισμός αναζήτησης
              </button>
            </div>
          ) : (
            <div className="items">
              {visibleEntries.map(({ entry, index }) => {
                const entryMastered = Boolean(mastered[entry.id]);
                return (
                  <div className="item" key={entry.id}>
                    <span className="item-num">{String(index + 1).padStart(2, "0")}</span>
                    <button
                      className="item-body sos-list-open"
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                    >
                      <span className="item-title">{entry.title}</span>
                    </button>
                    <span className="item-side">
                      <ScaleStrip
                        level={entryMastered ? 1 : 0}
                        max={1}
                        label="Κατοχή"
                        onSet={next => onToggleMastery(section, entry.id, next === 1)}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudyModuleLoading({ error, onRetry, onBack, onHome }) {
  return (
    <div className="mcq-select">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
        </button>
      </div>
      <div className="pinakakia-empty" role={error ? "alert" : "status"} aria-live="polite">
        <p>{error || "Φόρτωση υλικού μελέτης…"}</p>
        {error && <button className="results-btn" type="button" onClick={onRetry}>Νέα προσπάθεια</button>}
      </div>
    </div>
  );
}

function QuestionBankLoading({ error, onRetry, onSwitchProfile }) {
  return (
    <div className="mcq-select">
      <div className="pinakakia-empty" role={error ? "alert" : "status"} aria-live="polite">
        <p>{error || "Προετοιμασία της τράπεζας ερωτήσεων…"}</p>
        <div className="modal-actions">
          {error && <button className="results-btn primary" type="button" onClick={onRetry}>Νέα προσπάθεια</button>}
          <button className="results-btn" type="button" onClick={onSwitchProfile}>Αλλαγή προφίλ</button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description, icon, onBack, onHome }) {
  return (
    <div className="placeholder-page">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> Πίσω
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
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const screen = route.screen;
  const testMode = route.testMode || null;
  const selectedMcqTopic = route.mcqTopic || null;

  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  const setScreen = useCallback((nextScreen, options) => {
    navigate(pathForScreen(nextScreen), options);
  }, [navigate]);
  const setTestMode = useCallback((nextMode, options) => {
    if (nextMode || screen === "mcq") navigate(pathForMcqMode(nextMode), options);
  }, [navigate, screen]);
  const setSelectedMcqTopic = useCallback((nextTopic, options) => {
    if (nextTopic || (screen === "mcq" && testMode === "category")) {
      navigate(pathForMcqMode("category", nextTopic), options);
    }
  }, [navigate, screen, testMode]);
  const [oralViewerData, setOralViewerData] = useState(null);
  const [oralTableData, setOralTableData] = useState(null);
  const [crucialQuestionViewerData, setCrucialQuestionViewerData] = useState(null);
  const [referenceSources, setReferenceSources] = useState(null);
  const [referenceLoadError, setReferenceLoadError] = useState(null);
  const [mcqFeatureData, setMcqFeatureData] = useState({});
  const [mcqFeatureLoadError, setMcqFeatureLoadError] = useState(null);
  const [sosStudyData, setSosStudyData] = useState(null);
  const [sosStudyLoadError, setSosStudyLoadError] = useState(null);
  const [questionBankStatus, setQuestionBankStatus] = useState("idle");
  const [questionBankError, setQuestionBankError] = useState(null);
  const [showOpeningRequest, setShowOpeningRequest] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(DEFAULT_UPDATE_MESSAGE);
  const [updateMessageStatus, setUpdateMessageStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  // Seeded from local storage even when a remote value will follow: if the
  // remote write ever silently fails (missing table, RLS), this device's
  // last-known toggle still survives a refresh instead of appearing to revert.
  const [supportWidgetEnabled, setSupportWidgetEnabled] = useState(() => loadLocalSupportWidgetEnabled());
  const [supportWidgetDelayMinutes, setSupportWidgetDelayMinutes] = useState(() => loadLocalSupportWidgetDelayMinutes());
  const [profileStore, setProfileStore] = useState(() => loadProfileStore());
  const [syncStatus, setSyncStatus] = useState(ONLINE_PROFILES_ENABLED ? "loading" : "local");
  const [mcqQualitySignals, setMcqQualitySignals] = useState({});
  const [rememberAdmin, setRememberAdmin] = useState(() => loadRememberedAdminAccess());
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => isAdminProfile(profileStore.activeProfileId) && loadRememberedAdminAccess()
  );
  const remoteSaveTimerRef = useRef(null);
  const oralRemoteSaveTimerRef = useRef(null);
  const lastRemoteAttemptIdRef = useRef(null);
  const pendingMcqRemoteSaveRef = useRef(null);
  const pendingOralRemoteSaveRef = useRef(null);
  const selectedProfile = profileStore.activeProfileId
    ? profileStore.profiles[profileStore.activeProfileId]
    : null;
  const activeProfile = selectedProfile && (!isAdminProfile(selectedProfile) || adminUnlocked)
    ? selectedProfile
    : null;
  const hasAdminAccess = Boolean(activeProfile && isAdminProfile(activeProfile) && adminUnlocked);
  const handleThemePreferenceChange = useCallback((nextTheme) => {
    const profileId = profileStore.activeProfileId;
    const profile = profileId ? profileStore.profiles[profileId] : null;
    if (!profile) return;

    const nextProfile = {
      ...profile,
      themePreference: normalizeThemePreference(nextTheme),
    };
    setProfileStore(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [profileId]: nextProfile,
      },
    }));

    if (ONLINE_PROFILES_ENABLED) {
      setSyncStatus("saving");
      upsertRemoteProfile(nextProfile)
        .then(() => setSyncStatus("online"))
        .catch(() => setSyncStatus("offline"));
    }
  }, [profileStore.activeProfileId, profileStore.profiles]);
  const mcqProgress = activeProfile?.mcqProgress || createEmptyMcqProgress();
  const oralProgress = activeProfile?.oralProgress || createEmptyOralProgress();
  const sosProgress = activeProfile?.sosProgress || createEmptySosProgress();
  const mcqProgressSummary = useMemo(
    () => summarizeMcqProgress(mcqProgress),
    [mcqProgress, questionBankStatus]
  );
  const oralProgressSummary = useMemo(() => summarizeOralProgress(oralProgress), [oralProgress]);
  const selectedMcqTopicQuestions = useMemo(
    () => selectedMcqTopic
      ? selectTopicPracticeQuestions(getQuestionsForMcqTopic(selectedMcqTopic), mcqProgress, mcqQualitySignals)
      : [],
    [selectedMcqTopic, mcqProgress, mcqQualitySignals, questionBankStatus]
  );
  const syncMessage = useMemo(() => {
    if (!ONLINE_PROFILES_ENABLED) return "Η πρόοδος αποθηκεύεται μόνο σε αυτή τη συσκευή.";
    if (syncStatus === "loading") return "Φόρτωση προφίλ…";
    if (syncStatus === "saving") return "Αποθήκευση προόδου…";
    if (syncStatus === "offline") return "Ο συγχρονισμός δεν είναι διαθέσιμος. Η πρόοδος κρατιέται τοπικά.";
    return "Ο συγχρονισμός είναι ενεργός.";
  }, [syncStatus]);

  useEffect(() => {
    if (!route.valid) navigate("/", { replace: true });
  }, [navigate, route.valid]);

  // ─── Shell: theme, global search, shortcut sheet ───
  const { theme, toggleTheme } = useTheme(activeProfile?.themePreference, handleThemePreferenceChange);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = event => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Match on physical key, not the character: this interface is Greek, so
      // the user is normally in a Greek layout where Ctrl+K reports "κ".
      if ((event.ctrlKey || event.metaKey) && (event.code === "KeyK" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setPaletteOpen(open => !open);
        return;
      }
      if (typing) return;
      if (event.key === "?" || (event.shiftKey && (event.code === "Slash" || event.key === "/"))) {
        event.preventDefault();
        setShortcutsOpen(open => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── Resume: remember where the trainee last was ───
  const activeProfileId = profileStore.activeProfileId;
  const [resumePosition, setResumePosition] = useState(null);

  useEffect(() => {
    setResumePosition(loadStudyPosition(activeProfileId));
  }, [activeProfileId]);

  useEffect(() => {
    if (!activeProfileId || screen === "home") return;
    const title = SCREEN_TITLES[screen] || "Μελέτη";
    const label = testMode ? `${title} · ${MCQ_MODE_LABELS[testMode] || testMode}` : title;
    saveStudyPosition(activeProfileId, {
      path: location.pathname,
      title: label,
      screen,
    });
  }, [activeProfileId, screen, testMode, location.pathname]);

  const shellTitle = useMemo(() => {
    if (testMode) return MCQ_MODE_LABELS[testMode] || SCREEN_TITLES[screen] || "Μελέτη";
    return SCREEN_TITLES[screen] || "Επανάληψη Ψυχιατρικής";
  }, [screen, testMode]);

  const sectionCounts = useMemo(
    () => ({
      mcq: mcqProgressSummary?.review || null,
      oral: null,
      sos: null,
      pinakakia: null,
    }),
    [mcqProgressSummary]
  );

  const handlePaletteNavigate = useCallback(
    item => {
      navigate(item.path, { state: item.state || null });
    },
    [navigate]
  );

  useEffect(() => {
    if (rememberAdmin && isAdminProfile(selectedProfile)) setAdminUnlocked(true);
  }, [rememberAdmin, selectedProfile]);

  useEffect(() => {
    if (!activeProfile || questionBankStatus !== "idle") return undefined;

    setQuestionBankStatus("loading");
    setQuestionBankError(null);
    loadQuestionBank()
      .then(() => {
        setQuestionBankStatus("ready");
      })
      .catch(error => {
        console.error("Question bank could not be loaded", error);
        setQuestionBankError("Η τράπεζα ερωτήσεων δεν μπόρεσε να φορτωθεί.");
        setQuestionBankStatus("error");
      });
  }, [activeProfile, questionBankStatus]);

  useEffect(() => {
    if (screen !== "pinakakia" || referenceSources || referenceLoadError) return undefined;
    let cancelled = false;
    Promise.all([
      import("./data/oxfordBoxes.js"),
      import("./data/crashCourseBoxes.js"),
    ])
      .then(([oxfordModule, crashCourseModule]) => {
        if (cancelled) return;
        setReferenceSources({
          oxfordBoxes: oxfordModule.oxfordBoxes,
          crashCourseBoxes: crashCourseModule.crashCourseBoxes,
        });
      })
      .catch(error => {
        console.error("Reference material could not be loaded", error);
        if (!cancelled) setReferenceLoadError("Το υλικό αναφοράς δεν μπόρεσε να φορτωθεί.");
      });
    return () => {
      cancelled = true;
    };
  }, [referenceLoadError, referenceSources, screen]);

  useEffect(() => {
    if (!screen.startsWith("sos") || sosStudyData || sosStudyLoadError) return undefined;
    let cancelled = false;

    loadSosStudyData()
      .then(data => {
        if (!cancelled) setSosStudyData(data);
      })
      .catch(error => {
        console.error("SOS study material could not be loaded", error);
        if (!cancelled) setSosStudyLoadError("Το υλικό SOS δεν μπόρεσε να φορτωθεί.");
      });

    return () => {
      cancelled = true;
    };
  }, [screen, sosStudyData, sosStudyLoadError]);

  useEffect(() => {
    if (screen !== "mcq" || !["vignettes", "matching", "DSM5"].includes(testMode)) return undefined;
    if (mcqFeatureData[testMode] || mcqFeatureLoadError?.mode === testMode) return undefined;
    let cancelled = false;
    const loader = testMode === "vignettes"
      ? import("./data/mcqVignettes.js").then(module => ({ vignettes: module.default }))
      : testMode === "matching"
        ? import("./data/mcqMatching.js").then(module => ({ matchingSets: module.default }))
        : import("./data/dsm5trSelfExamQuestions.js").then(module => ({
            chapters: module.default,
            questionBank: module.dsm5trSelfExamQuestions,
          }));

    loader
      .then(data => {
        if (!cancelled) setMcqFeatureData(previous => ({ ...previous, [testMode]: data }));
      })
      .catch(error => {
        console.error(`${testMode} material could not be loaded`, error);
        if (!cancelled) setMcqFeatureLoadError({ mode: testMode, message: "Το υλικό δεν μπόρεσε να φορτωθεί." });
      });
    return () => {
      cancelled = true;
    };
  }, [mcqFeatureData, mcqFeatureLoadError, screen, testMode]);

  useEffect(() => {
    if (selectedMcqTopic && !MCQ_TOPIC_CATEGORIES.includes(selectedMcqTopic)) {
      navigate("/mcq/category", { replace: true });
    }
  }, [navigate, selectedMcqTopic]);

  useEffect(() => {
    if (!activeProfile) return;
    if ((screen === "oral-crucial-index" || screen === "oral-crucial-viewer") && !hasAdminAccess) {
      navigate("/oral", { replace: true });
      return;
    }
    if (screen === "oral-crucial-viewer" && !crucialQuestionViewerData) {
      navigate("/oral/crucial", { replace: true });
      return;
    }
    if (screen === "oral-viewer" && !oralViewerData) {
      navigate("/oral/past", { replace: true });
      return;
    }
    if (screen === "oral-table" && !oralTableData) {
      navigate("/oral/past", { replace: true });
      return;
    }
  }, [
    activeProfile,
    crucialQuestionViewerData,
    hasAdminAccess,
    navigate,
    oralTableData,
    oralViewerData,
    screen,
  ]);

  useEffect(() => {
    saveProfileStore(profileStore);
  }, [profileStore]);

  useEffect(() => {
    if (!ONLINE_PROFILES_ENABLED || questionBankStatus !== "ready") return;
    let cancelled = false;

    loadMcqQualitySignals()
      .then(signals => {
        if (!cancelled) setMcqQualitySignals(signals);
      })
      .catch(error => {
        console.error("MCQ quality signals could not be loaded", error);
      });

    return () => {
      cancelled = true;
    };
  }, [questionBankStatus]);

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
    loadRemoteSupportWidgetEnabled()
      .then(enabled => {
        if (cancelled) return;
        setSupportWidgetEnabled(enabled);
        saveLocalSupportWidgetEnabled(enabled);
      })
      .catch(() => {
        /* remote unreachable — keep the local (last-known) value already set */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ONLINE_PROFILES_ENABLED) return;
    let cancelled = false;
    loadRemoteSupportWidgetDelayMinutes()
      .then(minutes => {
        if (cancelled) return;
        setSupportWidgetDelayMinutes(minutes);
        saveLocalSupportWidgetDelayMinutes(minutes);
      })
      .catch(() => {
        /* remote unreachable — keep the local (last-known) value already set */
      });
    return () => {
      cancelled = true;
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

  const selectProfile = useCallback(async (profileId, password = "", options = {}) => {
    const profile = profileStore.profiles[profileId];
    if (isAdminProfile(profileId)) {
      const useRememberedAccess = options.useRememberedAccess && rememberAdmin;
      if (!useRememberedAccess) {
        const passwordMatches = await verifyAdminPassword(password);
        if (!passwordMatches) throw new Error("Λάθος κωδικός.");
      }
      setAdminUnlocked(true);
    } else {
      setAdminUnlocked(false);
    }

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
  }, [profileStore.profiles, rememberAdmin]);

  const toggleRememberAdmin = useCallback((remembered) => {
    saveRememberedAdminAccess(remembered);
    setRememberAdmin(remembered);
  }, []);

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

  const handleToggleSupportWidget = useCallback(() => {
    setSupportWidgetEnabled(prev => {
      const next = !prev;
      // Always write locally first: it's this device's source of truth on
      // reload even if the remote sync below fails silently.
      saveLocalSupportWidgetEnabled(next);
      if (ONLINE_PROFILES_ENABLED) {
        saveRemoteSupportWidgetEnabled(next).catch(() => {
          /* the toggle already persisted locally; a failed sync just means
             other visitors won't see the change until it's retried */
        });
      }
      return next;
    });
  }, []);

  const handleChangeSupportWidgetDelay = useCallback((minutes) => {
    const next = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : SUPPORT_WIDGET_DEFAULT_DELAY_MIN;
    setSupportWidgetDelayMinutes(next);
    saveLocalSupportWidgetDelayMinutes(next);
    if (ONLINE_PROFILES_ENABLED) {
      saveRemoteSupportWidgetDelayMinutes(next).catch(() => {
        /* persisted locally regardless */
      });
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
    if (!profileId) return;

    setProfileStore(prev => {
      const profile = prev.profiles[profileId];
      if (!profile) return prev;

      const currentProgress = profile.oralProgress || createEmptyOralProgress();
      const nextProgress = normalizeOralProgress(
        typeof nextOrUpdater === "function"
          ? nextOrUpdater(currentProgress)
          : nextOrUpdater
      );

      pendingOralRemoteSaveRef.current = { profileId, progress: nextProgress };

      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profileId]: {
            ...profile,
            oralProgress: nextProgress,
          },
        },
      };
    });
  }, [profileStore.activeProfileId]);

  useEffect(() => {
    const pending = pendingOralRemoteSaveRef.current;
    if (!pending) return;

    pendingOralRemoteSaveRef.current = null;
    queueRemoteOralProgressSave(pending.profileId, pending.progress);
  }, [profileStore, queueRemoteOralProgressSave]);

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

  // One update for a whole batch. updateOralProgress derives its next value
  // from the render's profile snapshot, so calling it in a loop would let the
  // last write win and silently drop the rest.
  const setOralQuestionsMastered = useCallback((questionIds) => {
    const ids = (questionIds || []).filter(Boolean);
    if (!ids.length) return;
    updateOralProgress(progress => {
      const current = normalizeOralProgress(progress);
      const nextMastered = { ...current.mastered };
      ids.forEach(id => { nextMastered[id] = true; });
      return { ...current, mastered: nextMastered, updatedAt: new Date().toISOString() };
    });
  }, [updateOralProgress]);

  const setSosEntryMastered = useCallback((section, entryId, mastered) => {
    const profileId = profileStore.activeProfileId;
    if (!profileId) return;

    setProfileStore(prev => {
      const profile = prev.profiles[profileId];
      if (!profile) return prev;

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

      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profileId]: {
            ...profile,
            sosProgress: nextProgress,
          },
        },
      };
    });

    if (ONLINE_PROFILES_ENABLED) {
      setSyncStatus("saving");
      saveRemoteSosMastery(profileId, section, entryId, mastered)
        .then(() => setSyncStatus("online"))
        .catch(() => setSyncStatus("offline"));
    }
  }, [profileStore.activeProfileId]);

  const switchProfile = useCallback(() => {
    setAdminUnlocked(false);
    setScreen('home');
    setProfileStore(prev => ({ ...prev, activeProfileId: null }));
  }, [setScreen]);

  const startMcqMode = useCallback((mode) => {
    if (mode !== "category") setSelectedMcqTopic(null);
    setTestMode(mode);
  }, [setSelectedMcqTopic, setTestMode]);

  if (!activeProfile) {
    return (
      <div className="app">
        <a className="skip-link" href="#main-content">Μετάβαση στο κύριο περιεχόμενο</a>
        <main id="main-content" tabIndex={-1}>
          <ProfileScreen
            profileStore={profileStore}
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            rememberedAdminAccess={rememberAdmin}
            onSelectProfile={selectProfile}
            onCreateProfile={createOrSelectProfile}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Μετάβαση στο κύριο περιεχόμενο</a>
      <AppShell
        screen={screen}
        title={shellTitle}
        counts={sectionCounts}
        profileName={activeProfile.name}
        isAdmin={hasAdminAccess}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateSection={section => navigate(section.path)}
        onOpenSearch={() => setPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onSwitchProfile={switchProfile}
        onHome={() => setScreen("home")}
        onOpenAdmin={hasAdminAccess ? () => setScreen("admin") : undefined}
      >
        <div className="sheet">
        {activeProfile && screen === 'admin' && (
          <AdminOptionsScreen
            onBack={() => setScreen('home')}
            supportWidgetEnabled={supportWidgetEnabled}
            onToggleSupportWidget={handleToggleSupportWidget}
            supportWidgetDelayMinutes={supportWidgetDelayMinutes}
            onChangeSupportWidgetDelay={handleChangeSupportWidgetDelay}
            supportWidgetSyncNote={ONLINE_PROFILES_ENABLED ? null : "μόνο σε αυτή τη συσκευή"}
          />
        )}
        {activeProfile && screen === 'home' && (
          <HomeScreen
            onNavigate={(id) => setScreen(id)}
            profileName={activeProfile.name}
            isAdmin={hasAdminAccess}
            rememberAdmin={rememberAdmin}
            onToggleRememberAdmin={toggleRememberAdmin}
            onSwitchProfile={switchProfile}
            updateMessage={updateMessage}
            updateMessageStatus={updateMessageStatus}
            onSaveUpdateMessage={handleSaveUpdateMessage}
            mcqProgressSummary={mcqProgressSummary}
            oralProgressSummary={oralProgressSummary}
            resumePosition={resumePosition}
            onResume={() => navigate(resumePosition.path)}
            onDismissResume={() => {
              clearStudyPosition(activeProfileId);
              setResumePosition(null);
            }}
            onOpenSearch={() => setPaletteOpen(true)}
          />
        )}
        {activeProfile && screen === 'pinakakia' && !referenceSources && (
          <div className="pinakakia-screen">
            <div className="pinakakia-topbar">
              <button className="back-link" onClick={() => setScreen('home')}>
                <Icons.ChevronLeft /> Πίσω
              </button>
            </div>
            {referenceLoadError ? (
              <div className="pinakakia-empty" role="alert">
                <p>{referenceLoadError}</p>
                <button className="results-btn" type="button" onClick={() => setReferenceLoadError(null)}>
                  Νέα προσπάθεια
                </button>
              </div>
            ) : (
              <div className="pinakakia-empty" role="status" aria-live="polite">Φόρτωση υλικού αναφοράς…</div>
            )}
          </div>
        )}
        {activeProfile && screen === 'pinakakia' && referenceSources && (
          <PinakakiaModule
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
            routeScreen={route.tableScreen}
            routeChapter={route.tableChapter}
            referenceSources={referenceSources}
            isAdmin={isAdmin}
            onOpenDsm5={() => startMcqMode('DSM5')}
            onNavigate={(nextScreen, chapter, options = {}) => navigate(
              pathForTableScreen(nextScreen, chapter),
              { ...options, state: nextScreen === "viewer" ? { tableViewer: true } : null }
            )}
          />
        )}
        {activeProfile && screen === 'mcq' && questionBankStatus !== 'ready' && (
          <div className="sheet">
            <QuestionBankLoading
              error={questionBankError}
              onRetry={() => setQuestionBankStatus("idle")}
              onSwitchProfile={switchProfile}
            />
          </div>
        )}
        {activeProfile && screen === 'mcq' && questionBankStatus === 'ready' && !testMode && (
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
            progress={mcqProgress}
          />
        )}
        {activeProfile && screen === 'mcq' && ['vignettes', 'matching', 'DSM5'].includes(testMode) && !mcqFeatureData[testMode] && (
          <StudyModuleLoading
            error={mcqFeatureLoadError?.mode === testMode ? mcqFeatureLoadError.message : null}
            onRetry={() => setMcqFeatureLoadError(null)}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'vignettes' && mcqFeatureData.vignettes && (
          <McqVignetteMode
            vignettes={mcqFeatureData.vignettes.vignettes}
            progress={mcqProgress}
            onProgressChange={updateMcqProgress}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'matching' && mcqFeatureData.matching && (
          <McqMatchingMode
            matchingSets={mcqFeatureData.matching.matchingSets}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode === 'DSM5' && mcqFeatureData.DSM5 && (
          <DSM5McqMode
            chapters={mcqFeatureData.DSM5.chapters}
            questionBank={mcqFeatureData.DSM5.questionBank}
            onBack={() => setTestMode(null)}
            onHome={() => { setTestMode(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'mcq' && testMode && !['vignettes', 'matching', 'DSM5'].includes(testMode) && (testMode !== 'category' || selectedMcqTopic) && (
          <McqTest
            mode={testMode}
            progress={mcqProgress}
            qualitySignals={mcqQualitySignals}
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
          <OralHub
            onOpenPast={() => setScreen('oral-past')}
            onOpenSimulator={() => setScreen('oral-simulator')}
            canAccessCrucialQuestions={hasAdminAccess}
            onOpenCrucialQuestions={() => {
              setCrucialQuestionViewerData(null);
              setScreen('oral-crucial-index');
            }}
            oralProgress={oralProgress}
          />
        )}
        {activeProfile && screen === 'oral-past' && (
          <OralAccordion
            onBack={() => setScreen('oral')}
            onHome={() => setScreen('home')}
            onNavigateToViewer={(questions, title, initialIndex = 0) => {
              setOralViewerData({ questions, title, initialIndex });
              setScreen('oral-viewer');
            }}
            onNavigateToTable={(rows) => {
              setOralTableData(rows);
              setScreen('oral-table');
            }}
            oralProgress={oralProgress}
          />
        )}
        {hasAdminAccess && screen === 'oral-crucial-index' && (
          <CrucialQuestionsIndex
            onBack={() => setScreen('oral')}
            onHome={() => setScreen('home')}
            onOpenQuestion={(questions, initialIndex) => {
              setCrucialQuestionViewerData({ questions, initialIndex });
              setScreen('oral-crucial-viewer');
            }}
          />
        )}
        {hasAdminAccess && screen === 'oral-crucial-viewer' && crucialQuestionViewerData && (
          <CrucialQuestionViewer
            questions={crucialQuestionViewerData.questions}
            initialIndex={crucialQuestionViewerData.initialIndex}
            onBack={() => setScreen('oral-crucial-index')}
            onHome={() => { setCrucialQuestionViewerData(null); setScreen('home'); }}
          />
        )}
        {activeProfile && screen === 'oral-simulator' && (
          <OralExamSimulator
            onBack={() => setScreen('oral')}
            onHome={() => setScreen('home')}
            oralProgress={oralProgress}
            onQuestionMastered={setOralQuestionMastered}
            onQuestionsMastered={setOralQuestionsMastered}
          />
        )}
        {activeProfile && screen === 'oral-viewer' && oralViewerData && (
          <OralQuestionViewer
            questions={oralViewerData.questions}
            title={oralViewerData.title}
            initialIndex={oralViewerData.initialIndex}
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
            data={sosStudyData}
            sosProgress={sosProgress}
            onBack={() => setScreen('home')}
            onHome={() => setScreen('home')}
            onOpenSection={(sectionId) => setScreen(`sos-${sectionId}`)}
          />
        )}
        {activeProfile && screen.startsWith('sos-') && !sosStudyData && (
          <StudyModuleLoading
            error={sosStudyLoadError}
            onRetry={() => setSosStudyLoadError(null)}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'sos-numbers' && sosStudyData && (
          <SosEntrySection
            title="Αριθμοί που πρέπει να θυμάμαι"
            section="numbers"
            entries={sosStudyData.numbers}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            renderAnswer={entry => renderSosNumberText(getSosNumberFact(entry))}
            searchNoun={["αριθμό", "αριθμούς"]}
            countNoun={["αριθμός", "αριθμοί"]}
          />
        )}
        {activeProfile && screen === 'sos-highyield' && sosStudyData && (
          <SosHighYieldTables
            tables={sosStudyData.highYieldTables}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'sos-critical' && sosStudyData && (
          <SosEntrySection
            title="Κρίσιμα Θέματα"
            section="critical_topics"
            entries={sosStudyData.criticalTopics}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
          />
        )}
        {activeProfile && screen === 'sos-differential' && sosStudyData && (
          <SosEntrySection
            title="Διαφοροδιάγνωση"
            section="differential_diagnosis"
            entries={sosStudyData.differentialDiagnosis}
            sosProgress={sosProgress}
            onToggleMastery={setSosEntryMastered}
            onBack={() => setScreen('sos')}
            onHome={() => setScreen('home')}
            renderAnswer={entry => <DifferentialDiagnosisCard entry={entry} />}
            searchNoun={['θέμα διαφοροδιάγνωσης', 'θέματα διαφοροδιάγνωσης']}
            countNoun={['διαφοροδιάγνωση', 'διαφοροδιαγνώσεις']}
          />
        )}
        {activeProfile && screen === 'home' && showOpeningRequest && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Ενημερωτικό μήνυμα" onKeyDown={event => { if (event.key === "Escape") setShowOpeningRequest(false); }}>
            <div className="modal">
              <h3>Ένα μικρό request 🙂</h3>
              <p>
                Αν σας βοηθά η εφαρμογή, μοιραστείτε τη με συναδέλφους, αλλά ας μην τη φτάσει στα μάτια των εξεταστών.
                Θα ήταν κρίμα ένα εργαλείο που φτιάχτηκε για να βοηθήσει στην προετοιμασία να οδηγήσει τελικά σε αλλαγές στη διαδικασία των εξετάσεων.
              </p>
              <div className="modal-actions">
                <button className="results-btn primary" autoFocus onClick={() => setShowOpeningRequest(false)}>
                  Το κατάλαβα
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </AppShell>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handlePaletteNavigate}
      />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {supportWidgetEnabled && <SupportWidget delayMinutes={supportWidgetDelayMinutes} />}
    </div>
  );
}
