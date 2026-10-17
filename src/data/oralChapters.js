import { oralRetirements, oralConsolidatedPoints } from './oralRetirements';
import chapterThirteenFoundations from './oralChapter13Foundations';
import chapterThirteenNotes from './oralChapter13Notes';
import chapterFourteenNotes from './oralChapter14Notes';
import chapterFifteenNotes from './oralChapter15Notes';
import chapterSixteenNotes from './oralChapter16Notes';
import chaptersSeventeenToNineteenNotes from './oralChapters17to19Notes';
import chapterTwentyNotes from './oralChapter20Notes';
import chapterTwentyOneNotes from './oralChapter21Notes';
import chapterTwentyTwoNotes from './oralChapter22Notes';
import chapterTwentyFourNotes from './oralChapter24Notes';
import examStudyNotes from './oralExamStudyNotes';
import examMoodPsychosis from './oralExamMoodPsychosis';
import examPharmacology from './oralExamPharmacology';
import examClinicalExpansions, { appendSections } from './oralExamClinicalExpansions';
import { extraQuestions } from './oralExamAdditionalContent';
import examFoundations from './oralExamFoundations';
import examCarePlans from './oralExamCarePlans';

const revisionNotes = {
  ...chapterThirteenNotes, ...chapterFourteenNotes, ...chapterFifteenNotes,
  ...chapterSixteenNotes, ...chaptersSeventeenToNineteenNotes, ...chapterTwentyNotes,
  ...chapterTwentyOneNotes, ...chapterTwentyTwoNotes, ...chapterTwentyFourNotes,
  ...examStudyNotes, ...examMoodPsychosis, ...examPharmacology, ...examClinicalExpansions,
  ...examFoundations,
  ...examCarePlans,
};

for (const [id, sections] of Object.entries(appendSections)) {
  revisionNotes[id] = { ...revisionNotes[id], sections: [...revisionNotes[id].sections, ...sections] };
}

// Chapter names and sequence transcribed from the user's Greek contents photos.
export const oralChapters = [
  'Σημεία και συμπτώματα των ψυχιατρικών διαταραχών',
  'Ταξινόμηση', 'Αξιολόγηση', 'Ηθική και Αστικό Δίκαιο', 'Αιτιολογία',
  'Προσεγγίσεις στην ερευνητικά τεκμηριωμένη (evidence based) ψυχιατρική',
  'Αντιδράσεις σε στρεσογόνες εμπειρίες', 'Αγχώδεις και ιδεοψυχαναγκαστικές διαταραχές',
  'Κατάθλιψη', 'Διπολική διαταραχή', 'Σχιζοφρένεια', 'Παρανοειδή συμπτώματα και σύνδρομα',
  'Διαταραχές της πρόσληψης τροφής, του ύπνου και της σεξουαλικής ζωής',
  'Άνοια, delirium και άλλες νευροψυχιατρικές διαταραχές',
  'Προσωπικότητα και διαταραχές της προσωπικότητας', 'Παιδοψυχιατρική',
  'Νοητική υστέρηση', 'Ψυχιατροδικαστική', 'Ψυχιατρική των ηλικιωμένων',
  'Η χρήση αλκοόλ και ναρκωτικών', 'Αυτοκτονία και σκόπιμος αυτοτραυματισμός',
  'Ψυχιατρική και ιατρική', 'Παγκόσμια ψυχιατρική', 'Ψυχολογικές θεραπείες',
  'Φάρμακα και άλλες βιολογικές θεραπείες', 'Ψυχιατρικές υπηρεσίες',
].map((title, index) => ({ id: index + 1, title }));

// Explicit editorial placement. Never infer chapters from answer keywords.
const previousGroups = { '1A': 11, '1B': 14, '1Ca': 9, '1Cb': 9, '1Cg': 10, '1Cd': 21,
  '2A': 25, '2B': 25, '2C': 25, '3A': 8, '3B': 20, '3C': 14, '4A': 25,
  '4B': 24, '4C': 13, '4D': 16, '5A': 5, '5B': 15 };
const previousOverrides = {
  '1Aa2': 1, '1Aa3': 2, '1Ab6': 21, '1Ad3': 25, '1Ad4': 25, '1Ad5': 25,
  '1Ad6': 25, '1Ad7': 25, '1Ae1': 5, '1Ae2': 5, '1Ae4': 5, '1Ae5': 5,
  '1Az1': 24, '1Az2': 25, '1B6': 20, '1B7': 3, '1Cg3': 1,
  '3A3': 7, '3A4': 7, '3A5': 7, '3A6': 24, '4B5': 4, '4C4': 19,
  '5A4': 6, '5A7': 25, '5A8': 6, '5A9': 6, '5A10': 6, '5A11': 6, '5A12': 6,
};
const supplemental = [1,1,12,11,12,5,8,7,10,10,10,5,25,25,20,20,20,20,20,14,14,13,13,25,14,25,22,7,16];
// jan2026_16 asks specifically about neurological soft signs in schizophrenia.
const january = [25,9,5,5,5,10,10,8,7,9,15,25,13,20,16,11,5,20,14,25,8,5,14,10,9,10,10,15,5,15,25];
const core = [11,11,25,10,10,9,21,8,8,7,14,14,14,20,20,3,1,25,25,25,25,15,15,13,16,16,16,24,24,4,4,19,13,22,1,10,10,25,20];
const crucial = [3,1,3,21,21,18,3,4,4,1,11,11,11,5,11,11,11,11,25,9,9,9,10,10,10,10,22,
  8,8,8,8,7,7,7,22,22,20,20,20,20,20,20,20,20,14,14,14,14,14,14,14,19,14,14,14,22,1,14,
  16,16,17,13,13,13,13,13,13,15,15,15,13,13,13,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,
  24,24,24,24,5,5,5,10,9,25,8];

// Standalone follow-ups must be placed by the question's main task, not only
// by their original anchor's chapter. These moves were reviewed individually.
const editorialOverrides = {
  "oral_core_016_fu04": 4,
  "1Ae5": 11,
  "jan2026_04": 11,
  "jan2026_29": 11,
  "oral_core_009_fu01": 1,
  "oral_core_009_fu02": 1,
  "oral_core_006_fu05": 25,
  "oral_core_004_fu06": 4,
  "oral_core_005_fu05": 25,
  "oral_core_001_fu07": 25,
  "oral_core_002_fu04": 25,
  "oral_core_001_fu06": 25,
  "4C3": 9,
  "oral_core_033_fu03": 25,
  "Q6": 3,
  "oral_core_007_fu03": 4,
  "1Az1": 11
};

export function chapterForQuestion(id) {
  const examQuestion = extraQuestions.find(question => question.id === id);
  if (examQuestion) return examQuestion.chapter;
  const foundation = chapterThirteenFoundations.find(question => question.id === id);
  if (foundation) return foundation.chapter;
  if (Object.hasOwn(editorialOverrides, id)) return editorialOverrides[id];
  if (/^Q\d+$/.test(id)) return crucial[Number(id.slice(1)) - 1];
  if (id.startsWith('oral_challenge_')) return 3;
  if (id.startsWith('oral_core_')) return core[Number(id.split('_')[2]) - 1];
  if (id.startsWith('jan2026_')) return january[Number(id.split('_')[1]) - 1];
  if (id.startsWith('3D')) return supplemental[Number(id.slice(2)) - 1];
  if (previousOverrides[id]) return previousOverrides[id];
  return Object.entries(previousGroups).find(([prefix]) => id.startsWith(prefix))?.[1];
}


// Chapter 20 is a study sequence, not import order. Keep each substance's
// assessment, intoxication, withdrawal and management questions together.
// Explicit question IDs override keyword matching (e.g. naltrexone is also
// used in alcohol treatment); fallback leaves unfamiliar questions visible.
const substanceOrder = [
  ['general', ['Q37', '3D15', '3B9', 'jan2026_18', '3B7']],
  ['alcohol', ['oral_core_014', 'oral_core_014_fu01', 'Q38', 'oral_core_014_fu02',
    '1B6', 'oral_core_014_fu04', 'oral_core_014_fu06', '3B5', '3B3', 'Q39']],
  ['opioids', ['Q40', '3D18', '3B6']],
  ['cannabis', ['Q41', '3D17']],
  ['stimulants', ['Q42', '3D19', '3B8']],
  ['sedatives', ['Q43']],
  ['hallucinogens', ['3D16', 'oral_core_039']],
  ['behavioral', ['Q44']],
];
const substancePriority = new Map(substanceOrder.flatMap(([group, ids], groupIndex) =>
  ids.map((id, itemIndex) => [id, [groupIndex, itemIndex]])));
const substanceTerms = [
  /(?:διαταραχ.{0,25}χρήσ.{0,20}ουσι|εξάρτησ|ανοχ|στερητικ.{0,12}σύνδρομ|ανίχνευσ.{0,20}ούρ|νευροβιολογ)/i,
  /αλκοόλ|αιθανόλ|wernicke|korsakoff|delirium tremens|θειαμίν/i,
  /οπιοειδ|μορφίν|ηρωίν|μεθαδόν|βουπρενορφίν|ναλοξόν/i,
  /κάνναβ|κανναβι|\bTHC\b|\bCB1\b/i,
  /κοκαΐν|αμφεταμίν|μεθαμφεταμίν|διεγερτικ/i,
  /βενζοδιαζεπίν|ηρεμιστικ|υπνωτικ/i,
  /\bLSD\b|παραισθησιογόν|ψυχεδελικ/i,
  /τζόγ|gambling/i,
];
function chapterTwentySortKey(question) {
  const explicit = substancePriority.get(question.id);
  if (explicit) return explicit;
  const text = question.text || '';
  const group = substanceTerms.findIndex(re => re.test(text));
  return [group < 0 ? 8 : group, 1000];
}

const chapterThirteenOrder = [
  'Q62','ch13_eating_risk','oral_core_024','oral_core_024_fu01','Q63','oral_core_024_fu02','oral_core_024_fu03',
  '3D22','oral_core_024_fu05','Q64','ch13_binge_arfid',
  'Q67','4C1','4C2','Q65','jan2026_13','ch13_sleep_differential','Q66','ch13_parasomnias','oral_core_033',
  'Q71','ch13_sexual_categories','3D23','Q72','Q73',
];
const chapterThirteenPriority = new Map(chapterThirteenOrder.map((id,index)=>[id,index]));
function chapterThirteenGroup(question) {
  const text = question.text || '';
  if (/ανορεξ|βουλιμ|υπερφαγ|επανασίτισ|διατροφ|πρόσληψη τροφ/i.test(text)) return 0;
  if (/ύπν|αϋπν|υπνηλ|ναρκοληψ|REM|κιρκάδι/i.test(text)) return 1;
  if (/σεξουαλ|στυτικ|παραφιλ|φύλου/i.test(text)) return 2;
  return 3;
}

export function orderOralQuestions(questions) {
  return questions.map((question, originalIndex) => ({ question, originalIndex }))
    .sort((a, b) => {
      if (a.question.chapter === 13 && b.question.chapter === 13) {
        const ga = chapterThirteenGroup(a.question), gb = chapterThirteenGroup(b.question);
        return ga - gb || (chapterThirteenPriority.get(a.question.id) ?? 1000) - (chapterThirteenPriority.get(b.question.id) ?? 1000) || a.originalIndex - b.originalIndex;
      }
      if (a.question.chapter !== 20 || b.question.chapter !== 20) return a.originalIndex - b.originalIndex;
      const ka = chapterTwentySortKey(a.question);
      const kb = chapterTwentySortKey(b.question);
      return ka[0] - kb[0] || ka[1] - kb[1] || a.originalIndex - b.originalIndex;
    }).map(item => item.question);
}

export function buildOralBank(previous, clinical, crucialQuestions) {
  const history = previous.flatMap(group => (group.topics || []).flatMap(topic =>
    (topic.subtopics || [topic]).flatMap(section => (section.questions || []).map(q => ({
      ...q, kind: 'past', context: [topic.title, section !== topic && section.title].filter(Boolean).join(' · '),
    })))));
  return [...history, ...chapterThirteenFoundations, ...extraQuestions, ...clinical.map(q => ({ ...q, text: q.question, kind: 'clinical', context: q.subtopic })),
    ...crucialQuestions.map(q => ({ ...q, text: q.title, kind: 'crucial', context: '100 Κρίσιμα Θέματα' }))]
    .filter(q => !Object.hasOwn(oralRetirements, q.id))
    .map(q => ({ ...q, chapter: chapterForQuestion(q.id), additionalAnswer: oralConsolidatedPoints[q.id] || [],
      ...((revisionNotes[q.id] || q.studyNotes) ? { studyNotes: { ...(revisionNotes[q.id] || q.studyNotes), hideSources: true } } : {}),
    }));
}
