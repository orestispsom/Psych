import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sha256 = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;

export function assertSourceHashes(expected, sources) {
  for (const [file, text] of Object.entries(sources)) {
    if (sha256(text) !== expected[file]) throw new Error(`STALE: ${file} changed; re-review content.json against the new source before updating its hash`);
  }
}

export async function buildPack() {
  const [specText, answersText, coreText, protocol] = await Promise.all([
    fs.readFile(path.join(here, 'content.json'), 'utf8'),
    fs.readFile(path.join(root, 'src/data/oralCoreAnswerContent.js'), 'utf8'),
    fs.readFile(path.join(root, 'src/data/oralCore.js'), 'utf8'),
    fs.readFile(path.join(here, 'examiner-instructions.md'), 'utf8'),
  ]);
  const spec = JSON.parse(specText);
  assertSourceHashes(spec.sourceHashes, { 'src/data/oralCore.js': coreText, 'src/data/oralCoreAnswerContent.js': answersText });
  // Only the two fixed, repository-owned modules are loaded; no user-supplied code.
  const core = await import(moduleUrl(coreText.replace('"./oralCoreAnswerContent.js"', JSON.stringify(moduleUrl(answersText)))));
  const sourceQuestions = core.default;
  const topics = spec.topics.map(topic => {
    const source = sourceQuestions.find(q => q.id === topic.anchorId);
    if (!source?.answer) throw new Error(`Missing source ${topic.anchorId}`);
    const sourceLines = source.answer.split('\n');
    if (sourceLines.length !== topic.criteria.length) throw new Error(`Source structure changed: ${topic.anchorId}; re-review rubric`);
    const followUps = core.oralCoreAnchors.find(a => a.id === topic.anchorId).followUps.map(f => {
      const resolved = sourceQuestions.find(q => q.id === f.id);
      if (!resolved?.answer) throw new Error(`Missing follow-up answer ${f.id}`);
      return { ...f, answer: resolved.answer };
    });
    if (topic.clarificationQuestions.length !== topic.criteria.length) throw new Error(`Missing clarification: ${topic.anchorId}`);
    return {
      ...topic,
      openingQuestion: source.question,
      sourceAnswer: source.answer,
      reviewStatus: spec.reviewStatus,
      selectionBasis: 'Editorial pilot coverage; no measured exam-frequency claim',
      criteria: topic.criteria.map((label, index) => ({
        id: `${topic.anchorId}_c${index + 1}`, label,
        sourceId: topic.anchorId, sourceQuote: sourceLines[index],
        critical: topic.criticalIndexes.includes(index), essential: topic.essentialIndexes.includes(index),
        followUpId: `${topic.anchorId}_c${index + 1}_clarify`, clarificationQuestion: topic.clarificationQuestions[index],
      })),
      followUps,
      acceptableAlternatives: 'Credit semantically equivalent Greek or English terminology and clinically defensible alternatives. If the packet cannot establish correctness, mark uncertain and request review; never mark wrong solely for differing wording.',
    };
  });
  const calibration = topics.flatMap((topic, topicIndex) => ['adequate', 'partial', 'incorrect'].map(kind => ({
    id: `${topic.anchorId}_${kind}`,
    topicId: topic.anchorId,
    split: topicIndex >= 7 ? 'holdout' : 'development',
    provenance: 'Synthetic authored example; NOT a real candidate or clinician-rated gold answer',
    reviewStatus: 'PENDING', reviewer: null, reviewedAt: null,
    candidateAnswer: topic[kind],
    proposedJudgments: topic.criteria.map((c, i) => ({
      criterionId: c.id,
      status: kind === 'adequate' ? 'covered' : kind === 'partial' && topic.partialCoveredIndexes.includes(i) ? 'covered' : kind === 'incorrect' && topic.incorrectCriterionIndex === i ? 'incorrect' : 'missing',
      evidence: null,
    })),
    reviewTask: 'Verify each proposed judgment and add an exact supporting quote for covered/incorrect points. Check acceptable alternatives and opening-question scope. No aggregate pass mark is defined.',
  })));
  return {
    schemaVersion: spec.schemaVersion, reviewStatus: spec.reviewStatus,
    sourceHashes: { 'src/data/oralCore.js': sha256(coreText), 'src/data/oralCoreAnswerContent.js': sha256(answersText), 'tools/oral-pilot/content.json': sha256(specText), 'tools/oral-pilot/examiner-instructions.md': sha256(protocol) },
    protocol, topics, calibration,
  };
}

// Judgments come from a model or human. This function routes them; it does not
// infer clinical understanding from keywords. Candidate text is untrusted data.
export function nextAction(topic, judgments, { candidateAnswer, askedIds = [], answerCount = 1, maxAnswers = 4 } = {}) {
  if (typeof candidateAnswer !== 'string' || !candidateAnswer.trim()) throw new Error('Candidate answer required');
  if (!Number.isInteger(answerCount) || answerCount < 1 || !Number.isInteger(maxAnswers) || maxAnswers < 1) throw new Error('Invalid answer budget');
  const statuses = new Set(['covered', 'partial', 'missing', 'incorrect', 'uncertain']);
  if (judgments.length !== topic.criteria.length || new Set(judgments.map(j => j.criterionId)).size !== judgments.length) throw new Error('Require one judgment per criterion');
  const rows = topic.criteria.map(c => {
    const j = judgments.find(j => j.criterionId === c.id);
    if (!j || !statuses.has(j.status)) throw new Error(`Invalid judgment ${c.id}`);
    if (['covered', 'partial', 'incorrect'].includes(j.status) && (typeof j.evidence !== 'string' || !j.evidence.trim() || !candidateAnswer.includes(j.evidence))) throw new Error(`Exact evidence required: ${c.id}`);
    // Model output supplies judgments only; rubric scope, routing and source
    // attribution remain authoritative even if extra JSON fields are present.
    return { ...c, criterionId: j.criterionId, status: j.status, evidence: j.evidence };
  });
  const unresolved = rows.filter(r => r.status !== 'covered' && (r.essential || r.status === 'incorrect'));
  if (answerCount >= maxAnswers) return { action: 'finish_topic', reason: 'budget', unresolved, provisionalOnly: true };
  const uncertain = rows.find(r => r.status === 'uncertain');
  if (uncertain) return { action: 'clarify', criterionId: uncertain.id, question: 'Μπορείτε να διευκρινίσετε τι εννοείτε σε αυτό το σημείο;', requiresReview: true };
  const ordered = [...unresolved].sort((a, b) => Number(b.status === 'incorrect') - Number(a.status === 'incorrect') || Number(b.critical) - Number(a.critical));
  for (const row of ordered) {
    if (!askedIds.includes(row.followUpId)) return { action: 'follow_up', criterionId: row.id, questionId: row.followUpId, question: row.clarificationQuestion, reason: row.status };
  }
  if (unresolved.length) return { action: 'finish_topic', reason: 'unresolved_after_prompting', unresolved, provisionalOnly: true };
  const extension = topic.followUps.find(f => !askedIds.includes(f.id) && f.trigger === 'if_good_answer');
  return extension ? { action: 'extension', questionId: extension.id, question: extension.question } : { action: 'finish_topic', reason: 'core_covered', unresolved: [], provisionalOnly: true };
}

export function renderGuide(pack) {
  return [
    '# Psychiatry oral examiner pilot — reference guides',
    'REQUIRES_CLINICIAN_REVIEW. Repository teaching material, not independently verified current clinical/legal guidance. Use for supervised calibration. No pass/fail prediction.',
    'Selection: editorial coverage. No percentages or examiner-preference probabilities are inferred. Each topic has three proposed criteria scoped to its opening question; follow-ups may explore further domains.',
    ...pack.topics.map(t => [`## ${t.anchorId} — ${t.title}`, `Opening: ${t.openingQuestion}`, `Review flags: ${t.reviewFlags.join(' ')}`, '### Proposed criteria (essential vs extension)', ...t.criteria.map(c => `- ${c.id}: ${c.label}\n  Essential at opening: ${c.essential}. Critical for review: ${c.critical}. Source ${c.sourceId}: ${c.sourceQuote}\n  Authored clarification ${c.followUpId}: ${c.clarificationQuestion}`), '### Acceptable alternatives', t.acceptableAlternatives, '### Existing model answer (verbatim; not a mandatory script)', t.sourceAnswer, '### Available follow-ups and source answers', ...t.followUps.map(f => `- ${f.id} [${f.trigger}] ${f.question}\n  Source answer: ${f.answer}`)].join('\n\n')),
    '## Input versions', JSON.stringify(pack.sourceHashes, null, 2),
  ].join('\n\n') + '\n';
}

export async function exportPack(directory) {
  const pack = await buildPack();
  await fs.mkdir(directory, { recursive: true });
  const publicPack = { ...pack, topics: pack.topics.map(({ adequate, partial, incorrect, partialCoveredIndexes, incorrectCriterionIndex, ...t }) => t) };
  delete publicPack.calibration;
  await Promise.all([
    fs.writeFile(path.join(directory, 'examiner-instructions.md'), pack.protocol),
    fs.writeFile(path.join(directory, 'examiner-guides.md'), renderGuide(pack)),
    fs.writeFile(path.join(directory, 'examiner-pack.json'), JSON.stringify(publicPack, null, 2) + '\n'),
    fs.writeFile(path.join(directory, 'calibration-review.json'), JSON.stringify(pack.calibration, null, 2) + '\n'),
    fs.writeFile(path.join(directory, 'calibration-review.md'), [
      '# Calibration review — synthetic examples, PENDING',
      'Do not upload this file to the examiner Project. These proposed labels require clinician adjudication; they are not gold labels. Holdout examples must not be used to tune the prompt.',
      ...pack.calibration.map(c => `## ${c.id} (${c.split})\n\n${c.candidateAnswer}\n\nProposed judgments:\n\n${c.proposedJudgments.map(j => `- ${j.criterionId}: ${j.status}; candidate evidence: PENDING`).join('\n')}\n\nReviewer: PENDING. Clinical corrections / acceptable alternatives: PENDING.\n\n${c.reviewTask}`),
    ].join('\n\n') + '\n'),
    fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: pack.schemaVersion, reviewStatus: pack.reviewStatus, sourceHashes: pack.sourceHashes, topics: pack.topics.length, calibrationCases: pack.calibration.length }, null, 2) + '\n'),
  ]);
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, target] = process.argv.slice(2);
  if (command !== 'export' || !target) throw new Error('Usage: node tools/oral-pilot/pilot.mjs export <output-directory>');
  const pack = await exportPack(path.resolve(target));
  console.log(`Exported ${pack.topics.length} guides and ${pack.calibration.length} draft calibration cases to ${path.resolve(target)}. Clinician review PENDING.`);
}
