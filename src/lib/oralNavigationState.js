const STORAGE_PREFIX = "psychiatry-oral-navigation-v1";

export const ORAL_NAVIGATION_DEFAULTS = Object.freeze({
  view: "bands",
  openBandId: null,
  collapsedTopicIds: {},
  scrollY: 0,
});

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeView(view) {
  return view === "all" ? "all" : "bands";
}

function normalizeCollapsedTopics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, collapsed]) => typeof key === "string" && key && collapsed === true)
      .map(([key]) => [key, true])
  );
}

function normalizeScrollY(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeBandId(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getOralNavigationStorageKey(profileId) {
  const profileKey = String(profileId || "default").trim() || "default";
  return `${STORAGE_PREFIX}:${profileKey}`;
}

export function normalizeOralNavigationState(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    view: normalizeView(source.view),
    openBandId: normalizeBandId(source.openBandId),
    collapsedTopicIds: normalizeCollapsedTopics(source.collapsedTopicIds),
    scrollY: normalizeScrollY(source.scrollY),
  };
}

export function loadOralNavigationState(profileId, storage) {
  const target = getStorage(storage);
  if (!target) return { ...ORAL_NAVIGATION_DEFAULTS };

  try {
    const raw = target.getItem(getOralNavigationStorageKey(profileId));
    if (!raw) return { ...ORAL_NAVIGATION_DEFAULTS };
    return normalizeOralNavigationState(JSON.parse(raw));
  } catch {
    return { ...ORAL_NAVIGATION_DEFAULTS };
  }
}

export function saveOralNavigationState(profileId, patch, storage) {
  const target = getStorage(storage);
  if (!target) return normalizeOralNavigationState(patch);

  const current = loadOralNavigationState(profileId, target);
  const next = normalizeOralNavigationState({ ...current, ...(patch || {}) });

  try {
    target.setItem(getOralNavigationStorageKey(profileId), JSON.stringify(next));
  } catch {}

  return next;
}
