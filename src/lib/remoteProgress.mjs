function timestamp(value) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordTimestamp(record = {}) {
  return timestamp(record.updatedAt || record.lastAnsweredAt || record.seenAt);
}

function mergeRecords(remoteRecords = {}, localRecords = {}) {
  const merged = { ...remoteRecords };
  for (const [questionId, localRecord] of Object.entries(localRecords)) {
    const remoteRecord = merged[questionId];
    if (!remoteRecord || recordTimestamp(localRecord) >= recordTimestamp(remoteRecord)) {
      merged[questionId] = localRecord;
    }
  }
  return merged;
}

function mergeArraysById(remoteItems = [], localItems = [], limit = 500) {
  const items = new Map();
  [...remoteItems, ...localItems].forEach(item => {
    if (item?.id) items.set(String(item.id), item);
  });
  return [...items.values()]
    .sort((a, b) => timestamp(b.attemptedAt || b.completedAt || b.updatedAt) - timestamp(a.attemptedAt || a.completedAt || a.updatedAt))
    .slice(0, limit);
}

export function mergeMcqProgressSnapshots(remoteProgress = {}, localProgress = {}) {
  const remoteIsNewer = timestamp(remoteProgress.updatedAt) > timestamp(localProgress.updatedAt);
  const newer = remoteIsNewer ? remoteProgress : localProgress;
  const older = remoteIsNewer ? localProgress : remoteProgress;

  return {
    ...older,
    ...newer,
    version: 2,
    questions: mergeRecords(remoteProgress.questions, localProgress.questions),
    attempts: mergeArraysById(remoteProgress.attempts, localProgress.attempts, 500),
    sprintSessions: mergeArraysById(remoteProgress.sprintSessions, localProgress.sprintSessions, 30),
    writtenExamSessions: mergeArraysById(remoteProgress.writtenExamSessions, localProgress.writtenExamSessions, 30),
    dailyChallenges: {
      ...(remoteProgress.dailyChallenges || {}),
      ...(localProgress.dailyChallenges || {}),
    },
    bookmarks: {
      ...(remoteProgress.bookmarks || {}),
      ...(localProgress.bookmarks || {}),
    },
    updatedAt: newer.updatedAt || older.updatedAt || null,
  };
}

export function mergeOralProgressSnapshots(remoteProgress = {}, localProgress = {}) {
  const remoteIsNewer = timestamp(remoteProgress.updatedAt) > timestamp(localProgress.updatedAt);
  const newer = remoteIsNewer ? remoteProgress : localProgress;
  const older = remoteIsNewer ? localProgress : remoteProgress;
  return {
    ...older,
    ...newer,
    version: 1,
    mastered: {
      ...(remoteProgress.mastered || {}),
      ...(localProgress.mastered || {}),
    },
    updatedAt: newer.updatedAt || older.updatedAt || null,
  };
}

export async function fetchAllPages(fetchPage, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage({ offset, limit: pageSize });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
