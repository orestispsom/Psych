import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const bankPath = new URL('../src/data/questions.js', import.meta.url);
const raw = await readFile(bankPath, 'utf8');
const questions = JSON.parse(raw.replace(/^export default\s*/, '').replace(/;\s*$/, ''));

const normalize = (value) => value
  .normalize('NFC')
  .toLocaleLowerCase('el-GR')
  .replace(/[«»“”"'’`.,;:!?()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const findings = [];
const add = (severity, rule, id, detail) => findings.push({ severity, rule, id, detail });

const ids = new Set();
const stems = new Map();
const allowedSourceStatuses = new Set(['exact', 'near_exact', 'fabricated']);
const allowedQualityStatuses = new Set(['good', 'unchecked']);

for (const [index, question] of questions.entries()) {
  const id = question.id ?? `index:${index}`;

  if (!Number.isInteger(question.id)) add('error', 'ID_TYPE', id, 'Question ID must be an integer.');
  if (ids.has(question.id)) add('error', 'DUPLICATE_ID', id, 'Question ID is repeated.');
  ids.add(question.id);

  for (const field of ['topic', 'source', 'stem', 'explanation']) {
    if (typeof question[field] !== 'string' || !question[field].trim()) {
      add('error', 'MISSING_TEXT', id, `Missing or empty ${field}.`);
    }
  }

  if (!Array.isArray(question.options) || question.options.length !== 5) {
    add('error', 'OPTION_COUNT', id, `Expected 5 options; found ${question.options?.length ?? 'none'}.`);
  } else {
    const normalizedOptions = question.options.map(normalize);
    if (normalizedOptions.some((option) => !option)) add('error', 'EMPTY_OPTION', id, 'One or more options are empty.');
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      add('error', 'DUPLICATE_OPTION', id, 'Two or more options are textually identical after normalization.');
    }
  }

  if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options?.length) {
    add('error', 'CORRECT_INDEX', id, `Invalid correct-answer index: ${question.correct}.`);
  }

  if (!allowedSourceStatuses.has(question.sourceStatus)) {
    add('error', 'SOURCE_STATUS', id, `Unexpected sourceStatus: ${question.sourceStatus ?? 'missing'}.`);
  }
  if (!allowedQualityStatuses.has(question.qualityStatus)) {
    add('error', 'QUALITY_STATUS', id, `Unexpected qualityStatus: ${question.qualityStatus ?? 'missing'}.`);
  }
  if (question.qualityStatus === 'unchecked') {
    add('review', 'UNCHECKED_QUALITY', id, 'Question has not passed the editorial quality gate.');
  }

  const stem = normalize(question.stem ?? '');
  if (stem) {
    const previousId = stems.get(stem);
    if (previousId !== undefined) add('review', 'DUPLICATE_STEM', id, `Same normalized stem as ID ${previousId}.`);
    else stems.set(stem, id);
  }

  if (/(?:όλα|όλες|όλοι|κανένα|καμία|κανείς|τίποτα|τίποτε)\s+(?:από\s+)?(?:τα|τις|τους)\s+παραπάνω/iu.test(question.options?.join(' ') ?? '')) {
    add('review', 'COMPOSITE_OPTION', id, 'Contains an all/none-of-the-above option; verify single-best-answer quality.');
  }
  if (/^(ποιο|ποια|ποιος)\s+(?:από\s+)?(?:τα\s+)?παρακάτω\s*[:;]?$/iu.test(question.stem?.trim() ?? '')) {
    add('review', 'EMPTY_LEAD_IN', id, 'Stem has no substantive lead-in beyond “which of the following”.');
  }
  if (/[\uFFFD]/u.test(JSON.stringify(question))) {
    add('error', 'ENCODING', id, 'Contains a Unicode replacement character.');
  }
  if (/(?:εξεταστικά|κλασική εξεταστική|η ζητούμενη απάντηση|όπως είναι διατυπωμένες οι επιλογές)/iu.test(`${question.stem ?? ''} ${question.explanation ?? ''}`)) {
    add('review', 'EXAM_META_LANGUAGE', id, 'Learner-facing text contains editorial or answer-key metadiscourse.');
  }
}

// Top-level question fields are formatted at four spaces. Scan the source form
// because JSON.parse/import would silently overwrite duplicate object keys.
let currentId = null;
let currentKeys = new Set();
for (const line of raw.split(/\r?\n/)) {
  const idMatch = line.match(/^    "id":\s*(\d+),?$/);
  if (idMatch) {
    currentId = Number(idMatch[1]);
    currentKeys = new Set();
  }
  const keyMatch = currentId === null ? null : line.match(/^    "([A-Za-z][A-Za-z0-9]*)":/);
  if (keyMatch) {
    const key = keyMatch[1];
    if (currentKeys.has(key)) add('error', 'DUPLICATE_FIELD', currentId, `Top-level field “${key}” appears more than once.`);
    currentKeys.add(key);
  }
  if (currentId !== null && /^  }(?:,|$)/.test(line)) currentId = null;
}

const bySeverity = Object.groupBy(findings, ({ severity }) => severity);
const counts = (values, key) => Object.fromEntries(
  [...Map.groupBy(values, (value) => value[key])]
    .map(([name, items]) => [name, items.length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el')),
);

const result = {
  bank: 'src/data/questions.js',
  sha256: createHash('sha256').update(raw).digest('hex'),
  questionCount: questions.length,
  firstId: questions.at(0)?.id,
  lastId: questions.at(-1)?.id,
  topicCount: new Set(questions.map(({ topic }) => topic)).size,
  topics: counts(questions, 'topic'),
  sourceStatuses: counts(questions, 'sourceStatus'),
  qualityStatuses: counts(questions, 'qualityStatus'),
  findings: {
    errors: bySeverity.error?.length ?? 0,
    review: bySeverity.review?.length ?? 0,
    byRule: counts(findings, 'rule'),
    items: findings,
  },
};

if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`MCQ bank: ${result.questionCount} questions, IDs ${result.firstId}–${result.lastId}, SHA-256 ${result.sha256}`);
  console.log(`Structural errors: ${result.findings.errors}`);
  console.log(`Editorial review findings: ${result.findings.review}`);
  for (const [rule, count] of Object.entries(result.findings.byRule)) console.log(`- ${rule}: ${count}`);
}

if (result.findings.errors > 0 || (process.argv.includes('--strict') && result.findings.review > 0)) {
  process.exitCode = 1;
}
