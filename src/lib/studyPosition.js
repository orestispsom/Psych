/**
 * Where the trainee was last studying, per profile.
 *
 * A returning user's first question is "what was I doing?" — this answers it
 * without a backend. Stored separately from progress so it never interferes
 * with the mastery model or its Supabase sync.
 */

const KEY = "psych_study_position_v1";

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — resuming is a convenience, not a requirement */
  }
}

export function loadStudyPosition(profileId) {
  if (!profileId) return null;
  const entry = readAll()[profileId];
  if (!entry || !entry.path || !entry.title) return null;
  return entry;
}

export function saveStudyPosition(profileId, position) {
  if (!profileId || !position || !position.path || !position.title) return;
  const store = readAll();
  store[profileId] = { ...position, savedAt: new Date().toISOString() };
  writeAll(store);
}

export function clearStudyPosition(profileId) {
  if (!profileId) return;
  const store = readAll();
  delete store[profileId];
  writeAll(store);
}
