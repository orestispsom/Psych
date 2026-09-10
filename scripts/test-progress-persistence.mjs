import assert from "node:assert/strict";
import test from "node:test";

import {
  attemptToRemoteRow,
  getChangedQuestionIds,
  mergeAttemptRows,
  mergeLegacyAndSessionProgress,
  questionStateToRemoteRow,
  remoteQuestionStateToRecord,
  toRemoteMcqSessionState,
} from "../src/progressPersistence.mjs";

test("session state excludes high-frequency question and attempt data", () => {
  const state = toRemoteMcqSessionState({
    version: 2,
    questions: { 1: { attempts: 1 } },
    attempts: [{ id: "a" }],
    bookmarks: { 1: true },
    writtenExamDraft: { id: "draft" },
    updatedAt: "2026-09-10T10:00:00.000Z",
  });

  assert.deepEqual(state, {
    version: 2,
    bookmarks: { 1: true },
    writtenExamDraft: { id: "draft" },
  });
});

test("newer session reset prevents stale legacy progress from reappearing", () => {
  const merged = mergeLegacyAndSessionProgress(
    {
      questions: { 1: { attempts: 3 } },
      attempts: [{ id: "old" }],
      bookmarks: { 1: true },
      updatedAt: "2026-09-10T10:00:00.000Z",
    },
    {
      state: { resetAt: "2026-09-10T11:00:00.000Z", bookmarks: {} },
      updated_at: "2026-09-10T11:00:00.000Z",
    }
  );

  assert.deepEqual(merged.questions, {});
  assert.deepEqual(merged.attempts, []);
  assert.deepEqual(merged.bookmarks, {});
});

test("question diffs identify seen-only and answered changes", () => {
  assert.deepEqual(
    getChangedQuestionIds(
      { questions: { 1: { seenAt: "a" }, 2: { attempts: 1 } } },
      { questions: { 1: { seenAt: "b" }, 2: { attempts: 1 }, 3: { seenAt: "c" } } }
    ).sort(),
    ["1", "3"]
  );
});

test("question state maps all behavior fields without counter loss", () => {
  const record = {
    seenAt: "2026-09-10T10:00:00.000Z",
    lastAnsweredAt: "2026-09-10T10:01:00.000Z",
    lastSelected: 0,
    lastCorrect: false,
    lastConfidence: 4,
    lastTimeTakenMs: 1234,
    lastPointsAwarded: 0,
    attempts: 2,
    seenCount: 3,
    correctCount: 1,
    wrongCount: 1,
    consecutiveCorrect: 0,
    consecutiveWrong: 1,
    confidentWrongCount: 1,
    masteryLevel: 2,
    nextReviewAt: "2026-09-11T10:00:00.000Z",
    averageTimeMs: 1000,
    totalPoints: 5,
    updatedAt: "2026-09-10T10:01:00.000Z",
  };
  const row = questionStateToRemoteRow("p", "1", record);
  const restored = remoteQuestionStateToRecord(row);

  assert.equal(row.last_selected, 0);
  assert.equal(row.seen_count, 3);
  assert.equal(restored.lastSelected, 0);
  assert.equal(restored.lastTimeTakenMs, 1234);
  assert.equal(restored.correctCount, 1);
  assert.equal(restored.wrongCount, 1);
});

test("attempt rows retain session and score detail and deduplicate by stable ID", () => {
  const local = {
    id: "attempt-1",
    sessionId: "written-session-1",
    mode: "written",
    questionId: 9,
    selected: 2,
    selectedOption: "C",
    isCorrect: true,
    confidence: 3,
    timeTakenMs: 900,
    pointBreakdown: { total: 4 },
    pointsAwarded: 4,
    streakPosition: 2,
    attemptedAt: "2026-09-10T10:00:00.000Z",
  };
  const remoteRow = { id: 44, ...attemptToRemoteRow("p", local) };
  const merged = mergeAttemptRows([local], [remoteRow]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].sessionId, "written-session-1");
  assert.deepEqual(merged[0].pointBreakdown, { total: 4 });
});

test("attempt reconstruction respects a profile reset tombstone", () => {
  const oldAttempt = {
    id: 1,
    client_attempt_id: "old",
    question_id: 1,
    mode: "random",
    selected_index: 0,
    selected_option: "A",
    is_correct: true,
    attempted_at: "2026-09-10T09:00:00.000Z",
  };

  assert.deepEqual(
    mergeAttemptRows([], [oldAttempt], 500, "2026-09-10T10:00:00.000Z"),
    []
  );
});
