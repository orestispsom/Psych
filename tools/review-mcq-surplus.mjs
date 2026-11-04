import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [bank, review, february] = await Promise.all([
  read('../src/data/questions.js').then(raw => JSON.parse(raw.replace(/^export default\s*/, '').replace(/;\s*$/, ''))),
  read('../docs/mcq-surplus-review.json').then(JSON.parse),
  read('../docs/february-2026-mcq-coverage.json').then(JSON.parse),
]);
const byId = new Map(bank.map(question => [question.id, question]));
const sourceLinks = new Set(february.rows.flatMap(row => row.questionIds));
for (const question of bank) {
  for (const ref of question.sourceRefs ?? []) {
    const match = /^bank_id_(\d+)$/.exec(ref);
    if (match) sourceLinks.add(Number(match[1]));
  }
}
const isProtected = question => sourceLinks.has(question.id) ||
  ['actual_exam', 'thessaloniki_examiner_bank', 'previous_whole_scans', 'february_2026_recall', 'september_2026_recall'].includes(question.source) ||
  question.sourceRefs?.includes('thessaloniki_examiner_bank') ||
  Boolean(question.recalledExam || question.scanQuestionNumber);

const tracked = new Set();
const proposed = new Set(review.filter(row => row.status === 'proposed').map(row => row.id));
const problems = [];
const rows = review.map(row => {
  const question = byId.get(row.id);
  if (tracked.has(row.id)) problems.push(`Duplicate tracking entry ${row.id}.`);
  tracked.add(row.id);
  if (!['proposed', 'kept', 'retired'].includes(row.status)) problems.push(`Unknown status for ${row.id}.`);
  if (row.status === 'retired') {
    if (question) problems.push(`Retired ID ${row.id} still exists in the active bank.`);
    return row;
  }
  if (!question) {
    problems.push(`Tracked ID ${row.id} is missing. Reconcile the review decision.`);
    return row;
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([question.stem, question.options, question.correct]))
    .digest('hex');
  if (row.fingerprint !== fingerprint) problems.push(`Item ${row.id} changed. Recheck the proposal before updating its fingerprint.`);
  if (row.status === 'proposed') {
    if (isProtected(question)) problems.push(`Protected exam or source-linked ID ${row.id} is proposed for removal.`);
    for (const id of row.keepIds) {
      if (!byId.has(id) || proposed.has(id)) problems.push(`Item ${row.id} would lose retained anchor ${id}.`);
    }
    if (row.kind === 'duplicate' && !row.keepIds.length) problems.push(`Duplicate ${row.id} needs a retained equivalent.`);
  }
  return { ...row, stem: question.stem, answer: question.options[question.correct] };
});

const normalize = text => text.normalize('NFC').toLocaleLowerCase('el-GR')
  .replace(/[^\p{L}\p{N}]+/gu, '');
const byStem = new Map();
for (const question of bank) {
  const stem = normalize(question.stem);
  const group = byStem.get(stem) ?? [];
  group.push({ id: question.id, protected: Boolean(isProtected(question)), answer: question.options[question.correct] });
  byStem.set(stem, group);
}
const duplicateLeads = [...byStem.values()].filter(group => group.length > 1);
// A short second pass. Shared answer text and overlapping stems are review leads only.
const words = text => new Set(text.normalize('NFD').toLocaleLowerCase('el-GR')
  .replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]{4,}/gu) ?? []);
const boilerplate = new Set(['ποιος', 'ποιο', 'ποια', 'παρακατω', 'περισσοτερο', 'καλυτερα', 'ειναι', 'ισχυει']);
const byAnswer = new Map();
for (const question of bank) {
  const key = normalize(question.options[question.correct]);
  const group = byAnswer.get(key) ?? [];
  const tokens = words(question.stem);
  for (const word of boilerplate) tokens.delete(word);
  group.push({ question, tokens });
  byAnswer.set(key, group);
}
const similarLeads = [];
for (const group of byAnswer.values()) {
  for (const [index, left] of group.entries()) {
    for (const right of group.slice(index + 1)) {
      const pair = [left.question, right.question];
      if (pair.every(q => isProtected(q) || tracked.has(q.id))) continue;
      if (normalize(pair[0].stem) === normalize(pair[1].stem)) continue;
      const shared = [...left.tokens].filter(word => right.tokens.has(word)).length;
      const overlap = shared / Math.min(left.tokens.size, right.tokens.size);
      if (shared >= 3 && overlap >= 0.6) {
        similarLeads.push({ ids: pair.map(q => q.id), overlap: Number(overlap.toFixed(2)) });
      }
    }
  }
}
similarLeads.sort((a, b) => b.overlap - a.overlap);
const report = { bankSize: bank.length, proposedCount: proposed.size, projectedSize: bank.length - proposed.size, problems, rows, duplicateLeads, similarLeads };
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Bank: ${report.bankSize} | proposed: ${report.proposedCount} | projected: ${report.projectedSize}`);
  for (const row of rows) {
    if (row.status !== 'proposed') continue;
    console.log(`\n#${row.id} [${row.kind}] ${row.stem ?? ''}\n  ${row.reason}${row.keepIds.length ? ' Retain: ' + row.keepIds.join(', ') : ''}`);
  }
  console.log(`\n${duplicateLeads.length} normalized same-stem groups for manual comparison. * marks protected IDs.`);
  for (const group of duplicateLeads) console.log(group.map(q => q.id + (q.protected ? '*' : '')).join(' / '));
  console.log(`\n${similarLeads.length} additional same-answer, similar-stem leads for review.`);
  for (const lead of similarLeads) console.log(lead.ids.join(' / ') + ' (' + lead.overlap + ')');
  for (const problem of problems) console.error(problem);
}
if (problems.length) process.exitCode = 1;
