import evidence from "./data/written-exam-evidence.json" with { type: "json" };

// [total, clinical vignettes]. A vignette requires using case details to answer.
export const WRITTEN_BLUEPRINT = Object.freeze({
  P: [23, 6], B: [11, 1], M: [9, 3], S: [12, 4], D: [6, 2],
  O: [6, 3], U: [8, 3], T: [5, 1], H: [3, 0], R: [4, 0],
  A: [3, 1], L: [1, 0], C: [1, 0], N: [0, 0], Q: [4, 0], X: [4, 2],
});

const topicDomains = new Map([
  ["Ψυχοφαρμακολογία", "P"], ["Βιολογικές θεραπείες", "P"],
  ["Διαταραχές διάθεσης", "M"], ["Αγχώδεις, ΙΨΔ και τραύμα", "Q"], ["Ψυχωτικές διαταραχές", "S"], ["Ψυχοπαθολογία", "S"],
  ["Κατατονία και κινητικές διαταραχές", "S"], ["Διαταραχές προσωπικότητας", "D"],
  ["Ψυχιατρική ηλικιωμένων", "O"], ["Ιατρική και διασυνδετική ψυχιατρική", "O"],
  ["Διαταραχές χρήσης ουσιών", "U"], ["Ψυχοθεραπεία", "T"],
  ["Ιστορία, έρευνα και ταξινόμηση", "R"], ["Επείγουσα ψυχιατρική", "A"],
  ["Νομικά, δεοντολογία και ιατροδικαστική ψυχιατρική", "L"],
  ["Νευροαναπτυξιακές και παιδοψυχιατρική", "C"],
]);

const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const reviewScans = new Set(evidence.scannedReviewItems);
const recurringGroups = new Map(evidence.recurringTargets.flatMap((group, index) =>
  group.map(key => [key, index])
));

function sourceItems(question) {
  if (question.source === "previous_whole_scans") return ["scanned", [question.scanQuestionNumber]];
  if (question.recalledExam === "2026-02") return ["february", question.recalledItemNumbers ?? []];
  if (question.recalledExam === "2026-09") return ["september", question.recalledItemNumbers ?? []];
  return [null, []];
}

export function getWrittenExamTraits(question) {
  const [source, numbers] = sourceItems(question);
  const labeled = source && evidence[source].domains[numbers[0] - 1];
  const stem = normalize(question.stem);
  const answer = normalize(question.options?.[question.correct]);
  const topic = question.clinicalTopic ?? question.topic;
  const base = topicDomains.get(topic);
  let domain = base ?? "X";

  if (labeled) domain = labeled;
  else if (base === "C" || base === "L") domain = base;
  else if (/ποιος.*(πρωτος|εισηγαγε|ανακαλυψ|περιεγραψ|ανεπτυξ)|ιστορικ.*(πρωτ|γεγον|εξελιξ)|αποασυλοποι|\bλερο[υς]?\b/.test(stem)) domain = "H";
  else if (/νευροαπεικονισ|νευροανατομ|νευροβιολογ|μεταιχμιακο συστημα|νευροπλαστικ|μορφομετρ|εγκεφαλικ[ηο][ςν]? (περιοχη|σχηματισμ|δομη)|ιονοτροπ|δευτερογεν[ηε] μηνυ|πυρην.{0,14}ραφης/.test(stem + " " + answer)) domain = "B";
  else if (topic === "Νευρολογικές και Οργανικές Διαταραχές") {
    domain = /ντελιρ|delirium|ανοια|νευρογνωσ|αλτσχ|alzheimer|lewy|charles bonnet|ψευδοανοια|οξεια συγχυ/.test(stem + " " + answer) ? "O" : "N";
  } else if (!base && /θεραπευτη|ψυχοθεραπ|ψυχαναλυ|μεταβιβασ|μηχανισμ.{0,10}αμυν/.test(stem)) domain = "T";
  else if (!base && question.section === "Βιολογική Ψυχιατρική και Φαρμακολογία" &&
    /φαρμακ|αντιψυχωσ|αντικαταθλιπτ|λιθι|κλοζαπ/.test(stem + " " + answer)) domain = "P";

  // Catch recurring targets in the general bank as well as in the recall sets.
  const recurring = numbers.map(n => recurringGroups.get(source + ":" + n)).filter(id => id !== undefined);
  if (domain === "H" && /λιθι/.test(stem) && /cade|κ[εα]ιντ/.test(answer)) recurring.push("cade");
  if (domain === "B" && /(?:μεταιχμιακο|λιμβικο).*συστημα/.test(stem) &&
    /περιλαμβαν|ανηκ/.test(stem)) recurring.push("limbic-structures");

  const vignette = labeled ? evidence[source].cases.includes(numbers[0]) :
    /^(?:ενας? |μια |ενας? ασθενης |μια ασθενης )?(?:ανδρας|γυναικα|ασθενης|νεαρος|νεαρη|ηλικιωμεν|νοσηλευομεν|\d{2}(?:χρονος|χρονη| ετων))/.test(stem) &&
    /\d{2} ?(?:ετων|χρον)|προσερχ|παρουσιαζ|αναφερ|εμφανιζ|λαμβαν|ιστορικ|μεταφερ|διακομ|διαγνωσ/.test(stem);

  return {
    domain, vignette, source,
    recurring: [...new Set(recurring)],
  };
}

export function isWrittenExamEligible(question) {
  return question.options?.length === 5 && question.options.every(option => typeof option === "string" && option.trim()) &&
    Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 5 &&
    !["needs_review", "needs_edit", "remove_candidate"].includes(question.qualityStatus) &&
    !(question.source === "previous_whole_scans" && reviewScans.has(question.scanQuestionNumber));
}

export function selectByWrittenBlueprint({
  questions, count = 100, scoreQuestion, isRecent, trySelect, shuffle,
}) {
  const ranked = questions.filter(isWrittenExamEligible).map(question => ({
    question, ...getWrittenExamTraits(question), recent: isRecent(question), score: scoreQuestion(question),
  })).filter(row => WRITTEN_BLUEPRINT[row.domain][0] > 0)
    .sort((a, b) => Number(a.recent) - Number(b.recent) || b.score - a.score);
  const picked = [];
  const usedIds = new Set();
  const usedRecurring = new Set();
  const target = Math.min(count, ranked.length);
  const quotas = Object.entries(WRITTEN_BLUEPRINT).map(([domain, [total, cases]]) => ({
    domain, raw: total * target / 100, total: Math.floor(total * target / 100), cases,
  }));
  const remainder = target - quotas.reduce((sum, quota) => sum + quota.total, 0);
  const byRemainder = [...quotas].sort((a, b) => (b.raw - b.total) - (a.raw - a.total));
  byRemainder.slice(0, remainder).forEach(quota => { quota.total += 1; });
  const fill = (rows, limit) => {
    for (const row of rows) {
      if (picked.length >= limit) break;
      if (usedIds.has(row.question.id) || row.recurring.some(key => usedRecurring.has(key))) continue;
      if (!trySelect(row.question)) continue;
      picked.push(row.question);
      usedIds.add(row.question.id);
      row.recurring.forEach(key => usedRecurring.add(key));
    }
  };

  for (const { domain, total, cases } of quotas) {
    const rows = ranked.filter(row => row.domain === domain);
    const start = picked.length;
    const caseCount = Math.min(total, Math.round(cases * target / 100));
    fill(rows.filter(row => row.vignette), start + caseCount);
    fill(rows.filter(row => !row.vignette), start + total);
    fill(rows, start + total);
  }

  // A thin pool can borrow slots from core domains, never from standalone neurology
  // or additional pediatric items.
  fill(ranked.filter(row => row.domain !== "C"), target);
  return shuffle(picked);
}
