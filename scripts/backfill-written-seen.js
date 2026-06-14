const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#") && line.includes("="))
    .map(line => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

function quotePostgrestValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function supabaseTableRequest(table, query = {}, options = {}) {
  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

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
    throw new Error(await response.text() || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestDate(...values) {
  return values
    .map(normalizeDate)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
}

function sameTimestamp(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function getQuestionState(progress, questionId) {
  return progress?.questions?.[questionId] || progress?.questions?.[Number(questionId)] || {};
}

function collectSeenFromWrittenSessions(progress) {
  const seen = new Map();
  const sessions = Array.isArray(progress?.writtenExamSessions) ? progress.writtenExamSessions : [];

  for (const session of sessions) {
    const sessionDate = latestDate(session.completedAt, session.startedAt, session.createdAt, progress.updatedAt);
    const questionIds = Array.isArray(session.questionIds) ? session.questionIds : [];
    for (const rawQuestionId of questionIds) {
      const questionId = Number(rawQuestionId);
      if (!Number.isFinite(questionId)) continue;
      const previous = seen.get(questionId);
      seen.set(questionId, {
        questionId,
        seenCount: (previous?.seenCount || 0) + 1,
        lastSeenAt: latestDate(previous?.lastSeenAt, sessionDate),
      });
    }
  }

  const draftIds = Array.isArray(progress?.writtenExamDraft?.viewedQuestionIds)
    ? progress.writtenExamDraft.viewedQuestionIds
    : [];
  const draftDate = latestDate(progress?.writtenExamDraft?.updatedAt, progress?.updatedAt);
  for (const rawQuestionId of draftIds) {
    const questionId = Number(rawQuestionId);
    if (!Number.isFinite(questionId)) continue;
    const previous = seen.get(questionId);
    seen.set(questionId, {
      questionId,
      seenCount: Math.max(previous?.seenCount || 0, 1),
      lastSeenAt: latestDate(previous?.lastSeenAt, draftDate),
    });
  }

  return seen;
}

async function getExistingStates(profileId, questionIds) {
  const rows = [];
  for (const ids of chunk(questionIds, 90)) {
    if (!ids.length) continue;
    const result = await supabaseTableRequest("user_question_state", {
      select: "profile_id,question_id,seen_count,last_seen_at",
      profile_id: `eq.${profileId}`,
      question_id: `in.(${ids.join(",")})`,
      limit: "10000",
    });
    rows.push(...(result || []));
  }
  return new Map(rows.map(row => [Number(row.question_id), row]));
}

async function main() {
  const profiles = await supabaseTableRequest("study_profiles", {
    select: "id,name,mcq_progress",
    limit: "10000",
  });

  const allRows = [];
  const summary = [];

  for (const profile of profiles || []) {
    const progress = profile.mcq_progress || {};
    const seenByQuestion = collectSeenFromWrittenSessions(progress);
    const questionIds = [...seenByQuestion.keys()];
    if (!questionIds.length) continue;

    const existingByQuestion = await getExistingStates(profile.id, questionIds);
    let profileRows = 0;

    for (const [questionId, seenInfo] of seenByQuestion) {
      const state = getQuestionState(progress, String(questionId));
      const existing = existingByQuestion.get(questionId);
      const localSeenCount = Math.max(
        Number(state.seenCount || 0),
        Number(state.attempts || 0),
        state.seenAt ? 1 : 0,
        seenInfo.seenCount
      );
      const existingSeenCount = Number(existing?.seen_count || 0);
      const nextSeenCount = Math.max(existingSeenCount, localSeenCount);
      const nextLastSeenAt = latestDate(existing?.last_seen_at, state.seenAt, seenInfo.lastSeenAt, progress.updatedAt);

      if (nextSeenCount <= existingSeenCount && sameTimestamp(nextLastSeenAt, existing?.last_seen_at)) {
        continue;
      }

      allRows.push({
        profile_id: profile.id,
        question_id: questionId,
        seen_count: nextSeenCount,
        last_seen_at: nextLastSeenAt,
        updated_at: new Date().toISOString(),
      });
      profileRows += 1;
    }

    summary.push({
      profile: profile.name || profile.id,
      sessions: Array.isArray(progress.writtenExamSessions) ? progress.writtenExamSessions.length : 0,
      distinctSeenQuestions: questionIds.length,
      rowsToUpsert: profileRows,
    });
  }

  console.log(JSON.stringify({ apply: APPLY, profiles: summary, totalRowsToUpsert: allRows.length }, null, 2));

  if (!APPLY || !allRows.length) return;

  for (const rows of chunk(allRows, 500)) {
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

  console.log(`Backfilled ${allRows.length} user_question_state rows.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
