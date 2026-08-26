/**
 * One index over every study corpus in the product, so retrieval never
 * depends on first navigating to the screen that owns the material.
 *
 * Built lazily on first use and cached for the session. Each corpus is
 * imported with the same dynamic imports the screens use, so nothing extra
 * enters the initial bundle.
 */

export function normalizeGreekSearch(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .trim();
}

export const SCOPES = [
  { id: "all", label: "Όλα" },
  { id: "mcq", label: "Πολλαπλής" },
  { id: "oral", label: "Προφορικά" },
  { id: "sos", label: "SOS" },
  { id: "tables", label: "Πινακάκια" },
];

let indexPromise = null;

/**
 * `meta` is displayed, `body` is only searched. Answer text belongs in `body`
 * so a lookup can match on it without the result row turning into a paragraph.
 */
function entry(scope, kind, title, meta, path, state, body) {
  return {
    scope,
    kind,
    title: String(title || "").replace(/\s+/g, " ").trim(),
    meta: String(meta || "").replace(/\s+/g, " ").trim(),
    body: String(body || "").replace(/\s+/g, " ").trim(),
    path,
    state: state || null,
    haystack: "",
  };
}

async function safeImport(loader) {
  try {
    return await loader();
  } catch {
    return null;
  }
}

async function build() {
  const items = [];

  const questions = await safeImport(() => import("../data/questions.js"));
  if (questions?.default) {
    for (const question of questions.default) {
      items.push(
        entry(
          "mcq",
          "Ερώτηση",
          question.stem,
          question.topic || "",
          `/mcq/category/${encodeURIComponent(question.topic || "")}`,
          { questionId: question.id },
          question.explanation
        )
      );
    }
  }

  // Oral past questions live in a gravity → topic → subtopic → question tree.
  const oral = await safeImport(() => import("../data/oral.js"));
  for (const gravity of oral?.default || []) {
    for (const topic of gravity.topics || []) {
      const groups = topic.subtopics
        ? topic.subtopics.map(subtopic => [subtopic.questions, subtopic.title])
        : [[topic.questions, null]];
      for (const [questions, subtopicTitle] of groups) {
        for (const question of questions || []) {
          if (!question?.text) continue;
          items.push(
            entry(
              "oral",
              "Προφορικά",
              question.text,
              [gravity.label, topic.title, subtopicTitle].filter(Boolean).join(" · "),
              "/oral/past",
              { oralQuestionId: question.id, oralTopicId: topic.id },
              question.answer
            )
          );
        }
      }
    }
  }

  const crucial = await safeImport(() => import("../data/crucialQuestionsContent.js"));
  (crucial?.default || []).forEach((question, index) => {
    if (!question?.title) return;
    const bodyText = [
      ...(question.modelAnswer || []),
      ...(question.keyPoints || []),
      ...(question.examinerQuestions || []).map(eq => `${eq.question} ${(eq.answer || []).join(' ')}`),
      ...(question.examVsPractice || []),
    ].join(" ");
    items.push(
      entry(
        "oral",
        "Κρίσιμη ερώτηση",
        question.title,
        question.number ? `#${question.number}` : "",
        "/oral/crucial",
        { crucialIndex: index },
        bodyText
      )
    );
  });

  const sos = await safeImport(() => import("../data/sos.js"));
  if (sos) {
    for (const item of sos.sosNumbers || []) {
      items.push(entry("sos", "Αριθμός", item?.title, "", "/sos/numbers", null, item?.answer));
    }
    for (const item of sos.sosCriticalTopics || []) {
      items.push(entry("sos", "Κρίσιμο θέμα", item?.title, "", "/sos/critical", null, item?.answer));
    }
    for (const item of sos.sosDifferentialDiagnosis || []) {
      items.push(
        entry("sos", "Διαφοροδιάγνωση", item?.title, "", "/sos/differential", null, item?.answer)
      );
    }
  }

  const highYield = await safeImport(() => import("../data/highYieldPsychiatryTables.js"));
  for (const table of highYield?.highYieldPsychiatryTables || []) {
    items.push(
      entry("sos", "High-yield", table?.prompt, table?.topic || "", "/sos/high-yield", null, table?.answer)
    );
  }

  const oxford = await safeImport(() => import("../data/oxfordBoxes.js"));
  for (const box of oxford?.oxfordBoxes || []) {
    items.push(
      entry(
        "tables",
        box?.source || "Oxford",
        box?.title,
        [box?.boxNumber ? `Box ${box.boxNumber}` : "", box?.page ? `σ. ${box.page}` : ""]
          .filter(Boolean)
          .join(" · "),
        `/tables/oxford/chapters/${encodeURIComponent(box?.chapter ?? "")}`
      )
    );
  }

  const crash = await safeImport(() => import("../data/crashCourseBoxes.js"));
  for (const box of crash?.crashCourseBoxes || []) {
    items.push(
      entry(
        "tables",
        box?.source || "Crash Course",
        box?.title,
        [box?.boxNumber ? `Box ${box.boxNumber}` : "", box?.page ? `σ. ${box.page}` : ""]
          .filter(Boolean)
          .join(" · "),
        "/tables/crash/list"
      )
    );
  }

  for (const item of items) {
    item.haystack = normalizeGreekSearch(`${item.title} ${item.meta} ${item.body}`);
  }

  return items.filter(item => item.title);
}

export function getSearchIndex() {
  if (!indexPromise) {
    indexPromise = build().catch(error => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

/**
 * Rank by where the match lands: a title that starts with the query beats a
 * title that merely contains it, which beats a match only in the metadata.
 * Every term must appear, so multi-word queries narrow rather than widen.
 */
export function searchIndex(items, query, scope = "all", limit = 40) {
  const normalized = normalizeGreekSearch(query);
  if (normalized.length < 2) return [];
  const terms = normalized.split(/\s+/).filter(Boolean);
  const scoped = scope === "all" ? items : items.filter(item => item.scope === scope);
  const results = [];

  for (const item of scoped) {
    let ok = true;
    for (const term of terms) {
      if (!item.haystack.includes(term)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const titleNorm = normalizeGreekSearch(item.title);
    let score = 0;
    if (titleNorm.startsWith(normalized)) score = 3;
    else if (titleNorm.includes(normalized)) score = 2;
    else if (item.haystack.includes(normalized)) score = 1;
    results.push({ item, score, length: item.title.length });
    if (results.length > 3000) break;
  }

  results.sort((a, b) => b.score - a.score || a.length - b.length);
  return results.slice(0, limit).map(result => result.item);
}
