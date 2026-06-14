const fs = require("fs");
const path = require("path");
const os = require("os");

const AUTOMATION_ID = "weekly-mcq-feedback-review";
const DEFAULT_LIMIT = 1000;

function parseEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, value] = line.split(/=(.+)/, 2);
    env[key] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = {
    all: false,
    advanceCursor: false,
    json: false,
    since: null,
    setCursor: null,
    limit: DEFAULT_LIMIT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") args.all = true;
    else if (token === "--advance-cursor") args.advanceCursor = true;
    else if (token === "--json") args.json = true;
    else if (token === "--since") args.since = argv[++i] || null;
    else if (token === "--set-cursor") args.setCursor = argv[++i] || null;
    else if (token === "--limit") args.limit = Number(argv[++i] || DEFAULT_LIMIT);
  }

  return args;
}

function getCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getAutomationDir() {
  return path.join(getCodexHome(), "automations", AUTOMATION_ID);
}

function getStateFilePath() {
  return path.join(getAutomationDir(), "state.json");
}

function ensureAutomationDir() {
  fs.mkdirSync(getAutomationDir(), { recursive: true });
}

function readState() {
  const statePath = getStateFilePath();
  if (!fs.existsSync(statePath)) {
    return {
      automationId: AUTOMATION_ID,
      lastReviewedAt: null,
      updatedAt: null,
      lastFetchedRowCount: 0,
      lastFetchedLatestCreatedAt: null,
    };
  }

  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeState(state) {
  ensureAutomationDir();
  fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2) + "\n", "utf8");
}

function loadQuestions(repoRoot) {
  const raw = fs.readFileSync(path.join(repoRoot, "src", "data", "questions.js"), "utf8");
  return Function(raw.replace(/^export default/, "return"))();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function fetchFeedbackRows({ baseUrl, anonKey, since, limit }) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/rest/v1/mcq_feedback`);
  url.searchParams.set(
    "select",
    "feedback_type,feedback_comment,question_id,topic,subtopic,question_text_snapshot,created_at"
  );
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", String(limit));
  if (since) {
    url.searchParams.set("created_at", `gt.${since}`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function buildGroupedReport(rows, questions) {
  const byId = new Map(questions.map(question => [String(question.id), question]));
  const grouped = new Map();

  for (const row of rows) {
    const id = String(row.question_id);
    if (!grouped.has(id)) {
      grouped.set(id, {
        question_id: id,
        total: 0,
        byType: {},
        topic: row.topic || null,
        subtopic: row.subtopic || null,
        snapshot: row.question_text_snapshot || null,
        latest: row.created_at,
      });
    }

    const group = grouped.get(id);
    group.total += 1;
    group.byType[row.feedback_type] = (group.byType[row.feedback_type] || 0) + 1;
    if (row.created_at > group.latest) group.latest = row.created_at;
    if (!group.snapshot && row.question_text_snapshot) group.snapshot = row.question_text_snapshot;
    if (!group.topic && row.topic) group.topic = row.topic;
    if (!group.subtopic && row.subtopic) group.subtopic = row.subtopic;
  }

  let exactSnapshotMatchCount = 0;
  let snapshotMismatchCount = 0;
  let missingQuestionCount = 0;

  const top = Array.from(grouped.values())
    .map(group => {
      const question = byId.get(group.question_id);
      const exactMatch = question && group.snapshot
        ? normalizeText(question.stem) === normalizeText(group.snapshot)
        : null;

      if (!question) missingQuestionCount += 1;
      else if (exactMatch === true) exactSnapshotMatchCount += 1;
      else if (exactMatch === false) snapshotMismatchCount += 1;

      return {
        ...group,
        existsInCurrentBank: Boolean(question),
        exactSnapshotMatch: exactMatch,
        currentStem: question ? question.stem : null,
        priority:
          (group.byType.wrong_or_uncertain_answer || 0) * 5 +
          (group.byType.duplicate || 0) * 4 +
          (group.byType.wrong_terminology || 0) * 3 +
          (group.byType.comment || 0) * 2 +
          Math.max(0, group.total - 1),
      };
    })
    .sort((a, b) => b.priority - a.priority || b.total - a.total || a.question_id.localeCompare(b.question_id));

  return {
    groupedCount: grouped.size,
    exactSnapshotMatchCount,
    snapshotMismatchCount,
    missingQuestionCount,
    top,
  };
}

function printHuman(report) {
  const lines = [
    `Automation: ${report.automationId}`,
    `State file: ${report.stateFile}`,
    `Cursor used: ${report.cursorUsed || "none"}`,
    `Rows fetched: ${report.rowCount}`,
    `Latest fetched created_at: ${report.latestCreatedAt || "none"}`,
    `Grouped question IDs: ${report.groupedCount}`,
    `Exact snapshot matches: ${report.exactSnapshotMatchCount}`,
    `Snapshot mismatches: ${report.snapshotMismatchCount}`,
    `Missing current-bank IDs: ${report.missingQuestionCount}`,
    "",
    "Top grouped feedback:",
  ];

  for (const item of report.top.slice(0, 15)) {
    lines.push(
      `- ${item.question_id}: total=${item.total} priority=${item.priority} types=${JSON.stringify(item.byType)} match=${item.exactSnapshotMatch}`
    );
  }

  console.log(lines.join("\n"));
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const env = parseEnvFile(path.join(repoRoot, ".env"));

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  }

  const questions = loadQuestions(repoRoot);
  const state = readState();

  if (args.setCursor) {
    writeState({
      ...state,
      automationId: AUTOMATION_ID,
      lastReviewedAt: args.setCursor,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Cursor updated to ${args.setCursor}`);
    return;
  }

  const cursorUsed = args.all ? null : args.since || state.lastReviewedAt || null;
  const rows = await fetchFeedbackRows({
    baseUrl: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    since: cursorUsed,
    limit: args.limit,
  });

  const latestCreatedAt = rows.length ? rows[rows.length - 1].created_at : null;
  const grouped = buildGroupedReport(rows, questions);
  const report = {
    automationId: AUTOMATION_ID,
    stateFile: getStateFilePath(),
    cursorUsed,
    rowCount: rows.length,
    latestCreatedAt,
    ...grouped,
  };

  if (args.advanceCursor && latestCreatedAt) {
    writeState({
      automationId: AUTOMATION_ID,
      lastReviewedAt: latestCreatedAt,
      updatedAt: new Date().toISOString(),
      lastFetchedRowCount: rows.length,
      lastFetchedLatestCreatedAt: latestCreatedAt,
    });
    report.cursorAdvancedTo = latestCreatedAt;
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
    if (report.cursorAdvancedTo) {
      console.log(`\nCursor advanced to: ${report.cursorAdvancedTo}`);
    }
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
