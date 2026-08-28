import fs from 'node:fs';

const bankPath = new URL('../src/data/questions.js', import.meta.url);
const raw = fs.readFileSync(bankPath, 'utf8');
const questions = JSON.parse(raw.replace(/^export default\s*/, '').replace(/;\s*$/, ''))
  .filter((question) => question.id >= 3001);

const absoluteCue = /(πάντοτε|ποτέ|μόνο|αποκλειστικ|χωρίς|ανεξάρτητα|κάθε|αυτόματ|οριστικ|καθολικ|εξαλείφ)/i;
const findings = [];
let correctLongest = 0;
let lengthRatio125 = 0;
let clusteredCues = 0;
const answerPositions = [0, 0, 0, 0, 0];

for (const question of questions) {
  answerPositions[question.correct] += 1;
  const lengths = question.options.map((option) => option.length);
  const correctLength = lengths[question.correct];
  const meanDistractorLength = lengths
    .filter((_, index) => index !== question.correct)
    .reduce((sum, length) => sum + length, 0) / 4;
  const ratio = correctLength / meanDistractorLength;
  const distractorCueCount = question.options.filter(
    (option, index) => index !== question.correct && absoluteCue.test(option),
  ).length;
  const correctHasCue = absoluteCue.test(question.options[question.correct]);

  if (correctLength === Math.max(...lengths)) correctLongest += 1;
  if (ratio >= 1.25) lengthRatio125 += 1;
  if (distractorCueCount >= 2 && !correctHasCue) clusteredCues += 1;

  if (ratio >= 1.45) {
    findings.push(`ID ${question.id}: correct option is ${ratio.toFixed(2)}× the mean distractor length.`);
  }
  if (distractorCueCount >= 3 && !correctHasCue) {
    findings.push(`ID ${question.id}: ${distractorCueCount} distractors contain absolute/giveaway wording.`);
  }
}

const positionSpread = Math.max(...answerPositions) - Math.min(...answerPositions);
if (positionSpread > 1) {
  findings.push(`Correct-answer positions are imbalanced: ${answerPositions.join('/')}.`);
}

const summary = {
  questions: questions.length,
  answerPositions,
  correctOptionLongest: correctLongest,
  correctLengthRatioAtLeast125: lengthRatio125,
  clusteredAbsoluteCueSets: clusteredCues,
  severeFindings: findings.length,
};

console.log(JSON.stringify(summary, null, 2));
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
