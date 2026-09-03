const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
}

const tables = [
  "study_profiles",
  "user_question_state",
  "question_attempts",
  "game_sessions",
  "daily_challenges",
  "daily_challenge_items",
  "mcq_feedback",
  "sos_mastery",
  "app_settings",
];

const pageSize = 1000;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.resolve("backups", `supabase-${stamp}`);

function headers(extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

async function fetchTable(table) {
  const rows = [];
  let expectedCount = null;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: headers({
        Prefer: "count=exact",
        Range: `${offset}-${offset + pageSize - 1}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`${table}: ${response.status} ${await response.text()}`);
    }

    const range = response.headers.get("content-range");
    const total = Number(range?.split("/")[1]);
    if (Number.isFinite(total)) expectedCount = total;

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize || (expectedCount !== null && rows.length >= expectedCount)) break;
  }

  if (expectedCount !== null && rows.length !== expectedCount) {
    throw new Error(`${table}: expected ${expectedCount} rows, received ${rows.length}`);
  }
  return rows;
}

async function main() {
  await fs.mkdir(destination, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(),
    projectUrl: url,
    format: "Supabase REST JSON snapshot",
    tables: {},
  };

  for (const table of tables) {
    const rows = await fetchTable(table);
    const json = `${JSON.stringify(rows, null, 2)}\n`;
    const filename = `${table}.json`;
    await fs.writeFile(path.join(destination, filename), json, { flag: "wx" });
    manifest.tables[table] = {
      rows: rows.length,
      file: filename,
      sha256: crypto.createHash("sha256").update(json).digest("hex"),
    };
  }

  await fs.writeFile(
    path.join(destination, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" }
  );
  console.log(destination);
  console.log(JSON.stringify(manifest.tables, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
