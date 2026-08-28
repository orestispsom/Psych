import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(repoRoot, 'src', 'data', 'questions.js');
const reviewPath = path.join(repoRoot, 'tools', 'mcq-review', 'id-3001-plus-first-pass.json');

const rejected = new Set([3093, 3129, 3155, 3156, 3165, 3177, 3195, 3202, 3204]);
const rejectionReasons = {
  3093: 'Sensory adaptation was clinically sound but the answer remained apparent from generic assessment principles.',
  3129: 'Risk synthesis remained a comprehensive safe answer against four dismissive alternatives.',
  3155: 'Post-delirium cognitive follow-up remained generic and added little beyond existing delirium/dementia items.',
  3156: 'Temporary decision-making incapacity during delirium remained obvious from the elective nature of the procedure.',
  3165: 'Communication support in aphasia remained generic capacity practice rather than a discriminating MCQ.',
  3177: 'The binge-eating treatment target remained identifiable by rejecting clearly harmful compensatory behaviours.',
  3195: 'Violence-risk formulation remained a broad comprehensive answer against incomplete alternatives.',
  3202: 'Functional assessment of behaviour remained obvious from pain and environmental clues in the stem.',
  3204: 'Supportive therapy in acute crisis remained identifiable mainly from the unsafe tone of the alternatives.',
};

const refinements = {
  3010: {
    options: [
      'Οι στατικοί αποτυπώνουν ιστορικά δεδομένα· οι δυναμικοί μεταβαλλόμενους στόχους διαχείρισης',
      'Οι στατικοί περιγράφουν την τρέχουσα κλινική εικόνα· οι δυναμικοί το ιστορικό βίας',
      'Οι στατικοί αφορούν βραχυπρόθεσμο κίνδυνο· οι δυναμικοί μακροπρόθεσμο κίνδυνο',
      'Οι στατικοί μεταβάλλονται με παρέμβαση· οι δυναμικοί παραμένουν σχετικά αμετάβλητοι',
      'Οι στατικοί προέρχονται από αρχεία· οι δυναμικοί προέρχονται από την κλινική συνέντευξη',
    ],
    correct: 0,
  },
  3017: {
    options: [
      'Καρδιακές δυσπλασίες τύπου Ebstein και παροδική νεογνική υποτονία',
      'Μείζονες συγγενείς δυσπλασίες και δυσμενείς νευροαναπτυξιακές εκβάσεις',
      'Πρόωρη σύγκλειση αρτηριακού πόρου και νεογνική νεφρική δυσλειτουργία',
      'Στοματικές σχιστίες και επίμονη πνευμονική υπέρταση του νεογνού',
      'Νεογνικός τρόμος, ταχύπνοια και δυσκολία σίτισης τις πρώτες ημέρες',
    ],
    correct: 1,
  },
  3035: {
    options: [
      'Σοβαρή ευαισθησία στον αποκλεισμό των ντοπαμινεργικών D2 υποδοχέων',
      'Αυξημένη κεντρική αντιχολινεργική ευαισθησία της νόσου',
      'Μειωμένος ηπατικός μεταβολισμός της αλοπεριδόλης μέσω CYP2D6',
      'Απότομη επιδείνωση του παρκινσονισμού από στέρηση χολινεστεράσης',
      'Ταχεία εξέλιξη της υποκείμενης συναπτοπάθειας μετά από καταστολή',
    ],
    correct: 0,
  },
  3037: {
    options: [
      'Σταδιακή διακοπή της ζολπιδέμης και γνωσιακή-συμπεριφορική θεραπεία για αϋπνία',
      'Σταδιακή διακοπή της ζολπιδέμης και αντικατάσταση με διαζεπάμη μακράς δράσης',
      'Διατήρηση της ζολπιδέμης και προσθήκη θεραπείας περιορισμού ύπνου',
      'Αντικατάσταση της ζολπιδέμης με καθημερινή διφαινυδραμίνη',
      'Απότομη διακοπή της ζολπιδέμης και βραχεία χορήγηση αντιψυχωσικού',
    ],
    correct: 0,
  },
  3044: {
    options: [
      'Τη σημειακή εκτίμηση και το διάστημα εμπιστοσύνης της μεγαλύτερης μελέτης',
      'Το συνδυασμένο αποτέλεσμα και το αντίστοιχο διάστημα εμπιστοσύνης',
      'Το εύρος της ετερογένειας και το διάστημα εμπιστοσύνης του I²',
      'Την εκτίμηση του σφάλματος δημοσίευσης και το όριο στατιστικής σημαντικότητας',
      'Το αποτέλεσμα της ανάλυσης ευαισθησίας μετά τον αποκλεισμό μικρών μελετών',
    ],
    correct: 1,
  },
  3045: {
    options: [
      'Πιθανά φαινόμενα μικρών μελετών από σφάλμα δημοσίευσης, ετερογένεια ή άλλους μηχανισμούς',
      'Μεγάλη μεταξύ των μελετών ετερογένεια που δεν σχετίζεται με την ακρίβεια των εκτιμήσεων',
      'Διαφορετικό θεραπευτικό αποτέλεσμα στις μικρές μελέτες λόγω υψηλότερης στατιστικής ισχύος',
      'Ανεπαρκή αριθμό συμμετεχόντων για υπολογισμό συνδυασμένου αποτελέσματος',
      'Ασυμφωνία μεταξύ ανάλυσης κατά πρόθεση θεραπείας και ανάλυσης κατά πρωτόκολλο',
    ],
    correct: 0,
  },
  3048: {
    options: [
      'Το 78% των συμμετεχόντων είχε έκβαση αντίθετη από το συνολικό αποτέλεσμα',
      'Το 78% της συνολικής διακύμανσης αποδίδεται σε σφάλμα δημοσίευσης',
      'Υπάρχει σημαντική μεταξύ των μελετών ετερογένεια που χρειάζεται διερεύνηση',
      'Η μετα-ανάλυση έχει στατιστική ισχύ 78% για το πρωτεύον αποτέλεσμα',
      'Το μοντέλο τυχαίων επιδράσεων θα εξαλείψει το 78% της ετερογένειας',
    ],
    correct: 2,
  },
  3086: {
    options: [
      'Επανάληψη της ίδιας δοκιμασίας σε δώδεκα μήνες πριν συλλεχθούν άλλες πληροφορίες',
      'Πληρέστερη γνωστική και λειτουργική αξιολόγηση με ετεροαναφορικές πληροφορίες',
      'Διάγνωση μείζονος νευρογνωστικής διαταραχής από τη λειτουργική έκπτωση',
      'Απεικόνιση εγκεφάλου ως επόμενο διαγνωστικό βήμα πριν από νέα γνωστική εξέταση',
      'Αξιολόγηση κατάθλιψης ως εναλλακτική στη διερεύνηση νευρογνωστικής διαταραχής',
    ],
    correct: 1,
  },
  3100: {
    options: [
      'Κατανόηση των πληροφοριών για τη θεραπεία',
      'Συσχέτιση των πληροφοριών με τη δική του κατάσταση',
      'Συλλογισμός και σύγκριση των διαθέσιμων επιλογών',
      'Έκφραση σταθερής θεραπευτικής επιλογής',
      'Διατήρηση των πληροφοριών για αρκετό χρόνο ώστε να αποφασίσει',
    ],
    correct: 1,
  },
  3149: {
    options: [
      'Διακοπή μόλις αποκατασταθούν σίτιση και κινητικότητα',
      'Σταδιακή μείωση μετά από σταθερή ύφεση και θεραπεία της υποκείμενης αιτίας',
      'Σταθερή δόση μέχρι να ολοκληρωθεί η θεραπεία της υποκείμενης αιτίας',
      'Αντικατάσταση με αντιψυχωσικό πριν αρχίσει η μείωση της λοραζεπάμης',
      'Μείωση βάσει προκαθορισμένου σχήματος, ανεξάρτητα από κατατονικά σημεία',
    ],
    correct: 1,
  },
  3151: {
    options: [
      'Συνήθης δόση ενηλίκου με επανεκτίμηση μετά από έξι μήνες',
      'Χαμηλή αρχική δόση, σαφής στόχος και τακτική αναθεώρηση της ανάγκης συνέχισης',
      'Πολύ χαμηλή δόση με σταθερή διάρκεια έξι μηνών για πρόληψη υποτροπής',
      'Χορήγηση κατ’ επίκληση με βάση την κρίση του φροντιστή',
      'Συνδυασμός δύο χαμηλών δόσεων για περιορισμό ανεπιθύμητων ενεργειών',
    ],
    correct: 1,
  },
  3160: {
    options: [
      'Επιλογή φαρμάκου χαμηλού κινδύνου QT και επανέλεγχος ηλεκτρολυτών μετά την πρώτη δόση',
      'Διόρθωση ηλεκτρολυτών και ανασκόπηση όλων των φαρμάκων πριν από νέα συνταγογράφηση',
      'Επανάληψη ηλεκτροκαρδιογραφήματος μετά την υποχώρηση του συγκοπτικού επεισοδίου',
      'Προσθήκη β-αναστολέα πριν από τη διατήρηση των φαρμάκων που παρατείνουν το QT',
      'Καρδιολογική εκτίμηση μετά την επιλογή ψυχοτρόπου με χαμηλή αρχική δόση',
    ],
    correct: 1,
  },
  3166: {
    options: [
      'Πολυπαραγοντικό ντελίριο από φάρμακα, αφυδάτωση και κατακράτηση ούρων',
      'Οπιοειδική εξάρτηση με στερητικό σύνδρομο μεταξύ των δόσεων',
      'Ψυχωτική κατάθλιψη σχετιζόμενη με την τελική φάση της νόσου',
      'Άνοια με σωμάτια Lewy λόγω νυχτερινής διακύμανσης και ψευδαισθήσεων',
      'Πρωτοπαθής παραληρητική διαταραχή όψιμης έναρξης',
    ],
    correct: 0,
  },
  3189: {
    options: [
      'Επανεκπαίδευση αυτόματης κίνησης με λειτουργικές δραστηριότητες και μετατόπιση προσοχής',
      'Ενδυνάμωση με συνεχή προσοχή στην εκούσια σύσπαση του πάσχοντος μυός',
      'Αισθητηριακή επανεκπαίδευση πριν από κάθε προσπάθεια λειτουργικής κίνησης',
      'Προσωρινή ακινητοποίηση ώστε να διακοπεί το δυσλειτουργικό κινητικό πρότυπο',
      'Ψυχοθεραπεία μέχρι να εντοπιστεί εκλυτικός παράγοντας και έπειτα φυσικοθεραπεία',
    ],
    correct: 0,
  },
  3198: {
    options: [
      'Επαρκής έκθεση στην κλοζαπίνη με έλεγχο λήψης, επιπέδων, καπνίσματος και αλληλεπιδράσεων',
      'Μερική ανταπόκριση στην κλοζαπίνη μετά από προσθήκη δεύτερου αντιψυχωσικού',
      'Σταθερή αποχή από κάνναβη πριν από οποιαδήποτε μέτρηση επιπέδου κλοζαπίνης',
      'Αποτυχία ηλεκτροσπασμοθεραπείας ως ενίσχυσης της κλοζαπίνης',
      'Αποτυχία ψυχοκοινωνικής παρέμβασης για τα υπολειμματικά ψυχωσικά συμπτώματα',
    ],
    correct: 0,
  },
  3201: {
    options: [
      'Η μορφή των ψευδαισθήσεων και η ένταση του συναισθηματικού τους περιεχομένου',
      'Η χρονική σχέση χρήσης και συμπτωμάτων και η πορεία κατά τεκμηριωμένη αποχή',
      'Η θετική τοξικολογική εξέταση ούρων κατά την πρώτη προσέλευση',
      'Το οικογενειακό ιστορικό χρήσης κάνναβης ή άλλων ψυχοδραστικών ουσιών',
      'Η ταχύτητα μείωσης της διέγερσης μετά την πρώτη δόση αντιψυχωσικού',
    ],
    correct: 1,
  },
  3203: {
    options: [
      'Η αυτοκτονική συμπεριφορά ως στόχος που απειλεί τη ζωή',
      'Οι απουσίες ως συμπεριφορά που παρεμποδίζει τη θεραπεία',
      'Οι εργασιακές συγκρούσεις ως πρόβλημα ποιότητας ζωής',
      'Η ανεπάρκεια δεξιοτήτων ρύθμισης του συναισθήματος',
      'Οι παιδικές εμπειρίες ως μακροπρόθεσμος θεραπευτικός στόχος',
    ],
    correct: 0,
  },
};

const raw = fs.readFileSync(bankPath, 'utf8');
const bank = JSON.parse(raw.replace(/^export default\s*/, '').replace(/;\s*$/, ''));
const liveIds = new Set(bank.map((question) => question.id));
for (const id of [...rejected, ...Object.keys(refinements).map(Number)]) {
  if (!liveIds.has(id)) throw new Error(`Third-pass decision references non-live ID ${id}.`);
}

const resultingBank = bank
  .filter((question) => !rejected.has(question.id))
  .map((question) => ({ ...question, ...(refinements[question.id] ?? {}) }))
  .sort((a, b) => a.id - b.id);

const recent = resultingBank.filter((question) => question.id >= 3001);
const answerPositionPattern = [2, 0, 4, 1, 3];
for (const [index, question] of recent.entries()) {
  const target = answerPositionPattern[index % answerPositionPattern.length];
  if (question.correct === target) continue;
  const answer = question.options[question.correct];
  const distractors = question.options.filter((_, optionIndex) => optionIndex !== question.correct);
  distractors.splice(target, 0, answer);
  question.options = distractors;
  question.correct = target;
}

const report = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
report.thirdPass = {
  scope: 'Blind final review of every live MCQ with id >= 3001 after the second pass.',
  refinedIds: Object.keys(refinements).map(Number).sort((a, b) => a - b),
  rejectedIds: [...rejected].sort((a, b) => a - b),
  rejectionReasons,
  resultingRecentCount: recent.length,
  resultingBankSize: resultingBank.length,
};

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({
    refined: Object.keys(refinements).length,
    rejected: rejected.size,
    resultingRecentCount: recent.length,
    resultingBankSize: resultingBank.length,
  }, null, 2));
  process.exit(0);
}

fs.writeFileSync(bankPath, `export default ${JSON.stringify(resultingBank, null, 2)};\n`);
fs.writeFileSync(reviewPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Third pass refined ${Object.keys(refinements).length}, rejected ${rejected.size}, and retained ${resultingBank.length} live MCQs.`);
