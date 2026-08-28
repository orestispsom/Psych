import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(repoRoot, 'src', 'data', 'questions.js');
const reviewDir = path.join(repoRoot, 'tools', 'mcq-review');
const reviewPath = path.join(reviewDir, 'id-3001-plus-first-pass.json');

const decisions = {
  keep: [
    3031, 3033, 3034, 3040, 3041, 3042, 3043, 3044, 3045, 3046, 3047, 3049,
    3051, 3052, 3053, 3063, 3065, 3067, 3072, 3073, 3075, 3076, 3077, 3078,
    3079, 3085, 3088, 3089, 3095, 3097, 3100, 3102, 3104, 3106, 3109, 3110,
    3112, 3117, 3124, 3125, 3126, 3130, 3145, 3146, 3150, 3159, 3161, 3162,
    3164, 3169, 3170, 3173, 3180, 3191, 3194, 3203,
  ],
  rewrite_options: [
    3001, 3002, 3003, 3005, 3006, 3007, 3009, 3010, 3012, 3017, 3018, 3021,
    3022, 3029, 3035, 3036, 3037, 3038, 3048, 3054, 3055, 3056, 3066, 3068,
    3080, 3082, 3084, 3086, 3094, 3107, 3111, 3122, 3129, 3131, 3138, 3141,
    3149, 3151, 3152, 3156, 3157, 3168, 3178, 3190, 3197, 3204,
  ],
  rebuild: [
    3057, 3083, 3093, 3098, 3099, 3114, 3115, 3118, 3120, 3121, 3127, 3133,
    3134, 3135, 3136, 3137, 3139, 3140, 3144, 3147, 3148, 3153, 3154, 3155,
    3158, 3160, 3163, 3165, 3166, 3171, 3174, 3177, 3181, 3182, 3186, 3189,
    3193, 3195, 3196, 3198, 3201, 3202, 3205,
  ],
  delete: [
    3019, 3028, 3058, 3091, 3108, 3119, 3179, 3184, 3185, 3187, 3199, 3200,
  ],
};

const reasonByDecision = {
  keep: 'Provisional keep: worthwhile target and sufficiently competitive, parallel options in the first-pass editorial review.',
  rewrite_options: 'Quarantine: worthwhile target, but option length, phrasing, absolutes, or implausible distractors reveal the answer.',
  rebuild: 'Quarantine: worthwhile domain, but the stem and option set test generic safe conduct or rejection of absurd actions rather than discriminating psychiatric knowledge.',
  delete: 'Remove: redundant, overly generic, or too low-value to justify rebuilding for the final bank.',
};

const raw = fs.readFileSync(bankPath, 'utf8');
const questions = JSON.parse(raw.replace(/^export default\s*/, '').replace(/;\s*$/, ''));
const cohort = questions.filter((question) => question.id >= 3001);
const flattened = Object.values(decisions).flat();
const duplicateIds = flattened.filter((id, index) => flattened.indexOf(id) !== index);
const cohortIds = cohort.map((question) => question.id);
const missingIds = cohortIds.filter((id) => !flattened.includes(id));
const unknownIds = flattened.filter((id) => !cohortIds.includes(id));

if (duplicateIds.length || missingIds.length || unknownIds.length) {
  throw new Error(JSON.stringify({ duplicateIds, missingIds, unknownIds }));
}

const decisionById = new Map(
  Object.entries(decisions).flatMap(([decision, ids]) => ids.map((id) => [id, decision])),
);
const reviewed = cohort.map((question) => ({
  decision: decisionById.get(question.id),
  reason: reasonByDecision[decisionById.get(question.id)],
  question,
}));
const retainedQuestions = questions.filter(
  (question) => question.id < 3001 || decisionById.get(question.id) === 'keep',
);

const report = {
  schemaVersion: 1,
  auditedSourceCommit: '03a9b8c',
  scope: 'Every live MCQ with id >= 3001 at the start of the first pass.',
  limitations: [
    'This is an editorial and educational-value gate, not the final factual/source audit.',
    'Keep means provisionally retained for pass two; it does not mean final approval.',
    'Rewriting and factual re-verification are intentionally deferred to pass two.',
  ],
  counts: Object.fromEntries(Object.entries(decisions).map(([key, ids]) => [key, ids.length])),
  reviewed,
};

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({
    cohort: cohort.length,
    retained: decisions.keep.length,
    quarantined: decisions.rewrite_options.length + decisions.rebuild.length,
    deleted: decisions.delete.length,
    resultingBankSize: retainedQuestions.length,
  }, null, 2));
  process.exit(0);
}

fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(reviewPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(bankPath, `export default ${JSON.stringify(retainedQuestions, null, 2)};\n`);
console.log(`Wrote ${path.relative(repoRoot, reviewPath)} and retained ${retainedQuestions.length} live MCQs.`);
