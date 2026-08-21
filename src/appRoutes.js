const SCREEN_PATHS = {
  home: "/",
  pinakakia: "/tables",
  mcq: "/mcq",
  oral: "/oral",
  "oral-past": "/oral/past",
  "oral-viewer": "/oral/past/questions",
  "oral-table": "/oral/past/table",
  "oral-crucial-index": "/oral/crucial",
  "oral-crucial-viewer": "/oral/crucial/question",
  "oral-simulator": "/oral/simulator",
  sos: "/sos",
  "sos-numbers": "/sos/numbers",
  "sos-highyield": "/sos/high-yield",
  "sos-critical": "/sos/critical",
  "sos-differential": "/sos/differential",
};

const MCQ_PATH_MODES = {
  dsm5: "DSM5",
};

const MCQ_MODES = new Set([
  "sprint",
  "random",
  "daily",
  "weakness",
  "category",
  "written",
  "vignettes",
  "matching",
  "DSM5",
]);

const TABLE_PATHS = {
  sources: "/tables",
  "oxford-modes": "/tables/oxford",
  "oxford-chapters": "/tables/oxford/chapters",
  "crash-modes": "/tables/crash-course",
  "crash-list": "/tables/crash-course/list",
  viewer: "/tables/viewer",
};

function cleanPathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function pathForScreen(screen) {
  return SCREEN_PATHS[screen] || "/";
}

export function pathForMcqMode(mode, topic = null) {
  if (!mode) return "/mcq";
  const modePath = mode === "DSM5" ? "dsm5" : encodeURIComponent(mode);
  if (mode === "category" && topic) {
    return `/mcq/category/${encodeURIComponent(topic)}`;
  }
  return `/mcq/${modePath}`;
}

export function pathForTableScreen(screen, chapter = null) {
  if (screen === "oxford-boxes" && chapter !== null && chapter !== undefined) {
    return `/tables/oxford/chapters/${encodeURIComponent(chapter)}`;
  }
  return TABLE_PATHS[screen] || "/tables";
}

export function parseAppPath(pathname) {
  const path = cleanPathname(pathname);
  const segments = path.split("/").filter(Boolean).map(decodePathSegment);

  if (path === "/") return { valid: true, screen: "home", testMode: null };

  if (segments[0] === "mcq") {
    if (segments.length === 1) return { valid: true, screen: "mcq", testMode: null };
    const rawMode = segments[1];
    const testMode = MCQ_PATH_MODES[rawMode.toLowerCase()] || rawMode;
    return {
      valid: MCQ_MODES.has(testMode) && segments.length <= 3 && (testMode === "category" || segments.length === 2),
      screen: "mcq",
      testMode,
      mcqTopic: testMode === "category" && segments[2] ? segments[2] : null,
    };
  }

  if (segments[0] === "tables") {
    if (segments.length === 1) return { valid: true, screen: "pinakakia", tableScreen: "sources" };
    if (path === "/tables/oxford") return { valid: true, screen: "pinakakia", tableScreen: "oxford-modes" };
    if (path === "/tables/oxford/chapters") return { valid: true, screen: "pinakakia", tableScreen: "oxford-chapters" };
    if (segments.length === 4 && segments[1] === "oxford" && segments[2] === "chapters") {
      return { valid: true, screen: "pinakakia", tableScreen: "oxford-boxes", tableChapter: segments[3] };
    }
    if (path === "/tables/crash-course") return { valid: true, screen: "pinakakia", tableScreen: "crash-modes" };
    if (path === "/tables/crash-course/list") return { valid: true, screen: "pinakakia", tableScreen: "crash-list" };
    if (path === "/tables/viewer") return { valid: true, screen: "pinakakia", tableScreen: "viewer" };
    return { valid: false, screen: "pinakakia", tableScreen: "sources" };
  }

  const screen = Object.entries(SCREEN_PATHS).find(([, routePath]) => routePath === path)?.[0];
  return screen
    ? { valid: true, screen, testMode: null }
    : { valid: false, screen: "home", testMode: null };
}
