import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PsychFlashDatabase } from './db/database'
import { journal } from './cloud/sync'

export type Locale = 'en' | 'el'

const en = {
  studyCloudTitle: "Cloud progress",
  studyCloudHelp: "Study progress syncs automatically with the selected Psych profile. Offline changes upload when reconnected. Select the same profile on another device.",
  prefsTitle: "Study preferences",
  prefsNewLimit: "Daily new-topic limit (optional)",
  prefsNewPlaceholder: "3 topics per day",
  prefsNewHelp: "Defaults to 3 new topics per day. 0 pauses new topics. Due reviews remain included.",
  prefsOrder: "Due-review order",
  prefsOldest: "Oldest due first",
  prefsWeakest: "Difficult questions first",
  prefsIntensity: "Repetition intensity",
  prefsLight: "Light — fewer repetitions",
  prefsBalanced: "Balanced",
  prefsIntensive: "Intensive — more repetitions",
  prefsFuture: "Applies to future ratings, not existing due dates. Session preferences apply to newly created sessions.",
  prefsShuffle: "Shuffle questions within topics",
  prefsShortcuts: "Enable review keyboard shortcuts",

  libraryCurriculum: "Complete curriculum · {count} topics",
  studied: "studied",
  stateNew: "New",
  stateLearning: "Learning",
  stateDue: "Due",
  stateRetained: "Retained",
  progressMeasured: "Measured activity, not an exam-readiness score",
  coverage: "Coverage",
  topicsStudied: "Topics studied at least once",
  recentRecall: "Recent recall",
  recentRecallCaption: "Got it + Easy · {count} ratings in the past 14 days",
  dueWorkload: "Due workload",
  questionsDue: "Questions due now",
  domainsRevisit: "Domains to revisit",
  domainsRevisitCaption: "Lowest recall over 14 days, with at least 5 ratings per domain.",
  ratings: "ratings",
  notEnoughHistory: "Not enough review history yet.",

  today: 'Today',
  todayDailyStudy: 'Daily study',
  todayDailyPlan: 'New topics per day: {count} · due reviews included',
  todayExamPlan: 'Exam plan',
  todayDayRemaining: '1 day remaining',
  todayDaysRemaining: '{count} days remaining',
  todayExamPassed: 'Exam date has passed',
  todayFocusedWork: '{minutes} minutes of focused work',
  todayComplete: 'Today’s work is complete',
  todayGuidedSession:
    'One guided session: study new material, then retrieve what is due.',
  todayTopicsToStudy: 'topics to study',
  todayQuestionsToRetrieve: 'questions to retrieve',
  todayDueNow: 'due now',
  todayPaceWarning:
    'Your minutes target is below the pace needed for first exposure before the final review window. Due reviews remain included. Adjust the target or exam date in Settings.',
  todayExamDateWarning:
    'Update your exam date in Settings. Reviews continue; new study uses a steady 90-day horizon.',
  todayResumeSession: 'Resume session',
  todayStartSession: 'Start today’s session',
  todayLibraryFallback:
    'Use Library to revisit a topic. Due work will appear here automatically.',
  todayCurriculumStatus:
    '{count} curriculum topics · Progress syncs to your profile. Offline changes upload when you reconnect.',
  library: 'Library',
  progress: 'Progress',
  language: 'Language',
  english: 'English',
  greek: 'Greek',
  skip: 'Skip to content',
  search: 'Search',
  settings: 'Settings',
  settingsBackup: 'Settings and backup',
  loading: 'Loading curriculum and local progress…',
  retry: 'Retry',
  setupTitle: 'Plan your first study session',
  setupBody:
    'Set your exam date. Psych Flash combines new topics with reviews as they become due.',
  setupNote:
    'Educational material. Clinical/source review is pending. Progress stays on this device.',
  refresh: 'Refresh saved state',
  close: 'Close',
  closeDialog: 'Close dialog',
  searchTitle: 'Search study content',
  searchTopics: 'Search topics, questions and answers',
  searchPlaceholder: 'Topic, phrase or PSY ID',
  oneResult: '1 result',
  results: '{count} results',
  searchCurriculum: 'Search the complete curriculum.',
  question: 'Question',
  topic: 'Topic',
  back: 'Back',
  backToQuestion: 'Back to question',
  pauseSession: 'Pause session',
  sessionProgress: 'Session progress',
  reviewTopic: 'Review topic',
  revealAnswer: 'Reveal answer',
  testYourself: 'Test yourself',
  summary: 'Summary',
  revision: 'revision',
  ratingAgain: 'Again',
  ratingHard: 'Hard',
  ratingGood: 'Got it',
  ratingEasy: 'Easy',
  noMatch: 'No matching material.',
  showMore: 'Show 20 more',
  examDate: 'Exam date',
  dailyTarget: 'Daily minutes target',
  optional: '(optional)',
  noTimeCap: 'No time cap',
  dueIncluded: 'Due reviews are always included, even when they exceed your target.',
  continue: 'Continue',
  saveSettings: 'Save study settings',
  studyPlan: 'Study plan',
  languageContent: 'Language & content',
  languageHelp:
    'Changing language keeps the same progress and review history. Greek is shown for translated topics; topics not translated yet remain in English.',
  savedOnDevice: 'Saved on this device',
  autosaveBody:
    'Psych Flash saves automatically as you study: topic progress, review ratings and due dates, current session position, navigation state, study-plan settings and language preference.',
  backupIncludes:
    'The backup includes the saved study state above, active sessions and spaced-repetition scheduling.',
  localProgress: 'Backup & restore',
  noCloud:
    'There is no cloud sync. Clearing this site’s browser data removes the saved state on this device. Export a backup before replacing or clearing it.',
  exportProgress: 'Export progress JSON',
  importProgress: 'Import progress JSON',
  replacePrompt:
    'Replace all local saved state with this backup ({topics} topic records and {reviews} review events)?',
  replaceProgress: 'Replace local progress',
  cancelImport: 'Cancel import',
  backupExported: 'Backup exported. Keep the file somewhere safe.',
  exportFailed: 'Export failed. Your saved state has not changed.',
  backupTooLarge: 'Backup exceeds the 50 MB import limit.',
  invalidBackup: 'Invalid backup.',
  backupImported: 'Backup imported. Saved sessions, progress and preferences restored.',
  importFailed: 'Import failed.',
  disclaimer:
    'Educational revision material, not a prescribing or clinical decision tool. Clinical/source review remains pending.',
} as const

type Key = keyof typeof en

const el: Record<Key, string> = {
  studyCloudTitle: "Συγχρονισμός προόδου",
  studyCloudHelp: "Η πρόοδος συγχρονίζεται αυτόματα με το επιλεγμένο προφίλ του Psych. Οι αλλαγές εκτός σύνδεσης μεταφορτώνονται όταν συνδεθείς ξανά. Σε άλλη συσκευή επίλεξε το ίδιο προφίλ.",
  prefsTitle: "Προτιμήσεις μελέτης",
  prefsNewLimit: "Όριο νέων θεμάτων ανά ημέρα (προαιρετικό)",
  prefsNewPlaceholder: "3 θέματα ανά ημέρα",
  prefsNewHelp: "Προεπιλογή: 3 νέα θέματα ανά ημέρα. Το 0 σταματά τα νέα θέματα, αλλά οι οφειλόμενες επαναλήψεις παραμένουν.",
  prefsOrder: "Σειρά επαναλήψεων",
  prefsOldest: "Παλαιότερες οφειλόμενες πρώτα",
  prefsWeakest: "Δυσκολότερες ερωτήσεις πρώτα",
  prefsIntensity: "Ένταση επαναλήψεων",
  prefsLight: "Ήπια — λιγότερες επαναλήψεις",
  prefsBalanced: "Ισορροπημένη",
  prefsIntensive: "Εντατική — περισσότερες επαναλήψεις",
  prefsFuture: "Επηρεάζει τις μελλοντικές αξιολογήσεις, όχι τις υπάρχουσες ημερομηνίες επανάληψης. Οι προτιμήσεις συνεδρίας εφαρμόζονται στις νέες συνεδρίες.",
  prefsShuffle: "Τυχαία σειρά ερωτήσεων μέσα στα θέματα",
  prefsShortcuts: "Συντομεύσεις πληκτρολογίου για την επανάληψη",

  libraryCurriculum: "Πλήρης ύλη · {count} θέματα",
  studied: "μελετημένα",
  stateNew: "Νέο",
  stateLearning: "Σε εκμάθηση",
  stateDue: "Προς επανάληψη",
  stateRetained: "Συγκρατημένο",
  progressMeasured: "Μετρημένη δραστηριότητα, όχι εκτίμηση ετοιμότητας για τις εξετάσεις",
  coverage: "Κάλυψη ύλης",
  topicsStudied: "Θέματα που μελετήθηκαν τουλάχιστον μία φορά",
  recentRecall: "Πρόσφατη ανάκληση",
  recentRecallCaption: "Το θυμήθηκα + Εύκολο · {count} αξιολογήσεις στις τελευταίες 14 ημέρες",
  dueWorkload: "Επαναλήψεις που εκκρεμούν",
  questionsDue: "Ερωτήσεις προς επανάληψη τώρα",
  domainsRevisit: "Ενότητες για επανάληψη",
  domainsRevisitCaption: "Χαμηλότερη ανάκληση στις τελευταίες 14 ημέρες, με τουλάχιστον 5 αξιολογήσεις ανά ενότητα.",
  ratings: "αξιολογήσεις",
  notEnoughHistory: "Δεν υπάρχουν ακόμη αρκετές επαναλήψεις.",

  today: 'Σήμερα',
  todayDailyStudy: 'Καθημερινή μελέτη',
  todayDailyPlan: 'Νέα θέματα ανά ημέρα: {count} · οι οφειλόμενες επαναλήψεις περιλαμβάνονται',
  todayExamPlan: 'Πλάνο εξετάσεων',
  todayDayRemaining: 'Απομένει 1 ημέρα',
  todayDaysRemaining: 'Απομένουν {count} ημέρες',
  todayExamPassed: 'Η ημερομηνία εξετάσεων έχει παρέλθει',
  todayFocusedWork: '{minutes} λεπτά συγκεντρωμένης μελέτης',
  todayComplete: 'Η σημερινή μελέτη ολοκληρώθηκε',
  todayGuidedSession:
    'Μία καθοδηγούμενη συνεδρία: μελέτη νέου υλικού και στη συνέχεια ανάκληση όσων είναι προς επανάληψη.',
  todayTopicsToStudy: 'θέματα για μελέτη',
  todayQuestionsToRetrieve: 'ερωτήσεις για ανάκληση',
  todayDueNow: 'προς επανάληψη τώρα',
  todayPaceWarning:
    'Ο ημερήσιος στόχος λεπτών είναι χαμηλότερος από τον ρυθμό που απαιτείται για πρώτη μελέτη πριν από την τελική περίοδο επανάληψης. Οι οφειλόμενες επαναλήψεις παραμένουν στο πλάνο. Προσαρμόστε τον στόχο ή την ημερομηνία εξετάσεων στις Ρυθμίσεις.',
  todayExamDateWarning:
    'Ενημερώστε την ημερομηνία εξετάσεων στις Ρυθμίσεις. Οι επαναλήψεις συνεχίζονται και η νέα μελέτη υπολογίζεται με σταθερό ορίζοντα 90 ημερών.',
  todayResumeSession: 'Συνέχιση συνεδρίας',
  todayStartSession: 'Έναρξη σημερινής συνεδρίας',
  todayLibraryFallback:
    'Χρησιμοποιήστε τη Βιβλιοθήκη για επανάληψη ενός θέματος. Ό,τι γίνει απαιτητό θα εμφανιστεί εδώ αυτόματα.',
  todayCurriculumStatus:
    '{count} θέματα ύλης · Η πρόοδος συγχρονίζεται με το προφίλ σας. Οι αλλαγές εκτός σύνδεσης μεταφορτώνονται όταν συνδεθείτε ξανά.',
  library: 'Βιβλιοθήκη',
  progress: 'Πρόοδος',
  language: 'Γλώσσα',
  english: 'Αγγλικά',
  greek: 'Ελληνικά',
  skip: 'Μετάβαση στο περιεχόμενο',
  search: 'Αναζήτηση',
  settings: 'Ρυθμίσεις',
  settingsBackup: 'Ρυθμίσεις και αντίγραφο ασφαλείας',
  loading: 'Φόρτωση ύλης και τοπικής προόδου…',
  retry: 'Επανάληψη',
  setupTitle: 'Οργάνωσε την πρώτη συνεδρία μελέτης',
  setupBody:
    'Όρισε την ημερομηνία των εξετάσεων. Το Psych Flash συνδυάζει νέα θέματα με επαναλήψεις όταν αυτές γίνονται απαιτητές.',
  setupNote:
    'Εκπαιδευτικό υλικό. Η κλινική/βιβλιογραφική ανασκόπηση εκκρεμεί. Η πρόοδος αποθηκεύεται σε αυτή τη συσκευή.',
  refresh: 'Ανανέωση αποθηκευμένης κατάστασης',
  close: 'Κλείσιμο',
  closeDialog: 'Κλείσιμο παραθύρου',
  searchTitle: 'Αναζήτηση στη Μελέτη',
  searchTopics: 'Αναζήτηση σε θέματα, ερωτήσεις και απαντήσεις',
  searchPlaceholder: 'Θέμα, φράση ή κωδικός PSY',
  oneResult: '1 αποτέλεσμα',
  results: '{count} αποτελέσματα',
  searchCurriculum: 'Αναζήτηση σε ολόκληρη την ύλη.',
  question: 'Ερώτηση',
  topic: 'Θέμα',
  back: 'Πίσω',
  backToQuestion: 'Πίσω στην ερώτηση',
  pauseSession: 'Παύση συνεδρίας',
  sessionProgress: 'Πρόοδος συνεδρίας',
  reviewTopic: 'Επανάληψη θέματος',
  revealAnswer: 'Εμφάνιση απάντησης',
  testYourself: 'Έλεγξε τις γνώσεις σου',
  summary: 'Σύνοψη',
  revision: 'αναθεώρηση',
  ratingAgain: 'Ξανά',
  ratingHard: 'Δύσκολο',
  ratingGood: 'Το θυμήθηκα',
  ratingEasy: 'Εύκολο',
  noMatch: 'Δεν βρέθηκε σχετικό υλικό.',
  showMore: 'Εμφάνιση 20 ακόμη',
  examDate: 'Ημερομηνία εξετάσεων',
  dailyTarget: 'Ημερήσιος στόχος λεπτών',
  optional: '(προαιρετικό)',
  noTimeCap: 'Χωρίς χρονικό όριο',
  dueIncluded:
    'Οι οφειλόμενες επαναλήψεις περιλαμβάνονται πάντα, ακόμη κι αν υπερβαίνουν τον στόχο.',
  continue: 'Συνέχεια',
  saveSettings: 'Αποθήκευση ρυθμίσεων μελέτης',
  studyPlan: 'Πλάνο μελέτης',
  languageContent: 'Γλώσσα και περιεχόμενο',
  languageHelp:
    'Η ύλη είναι διαθέσιμη στα Ελληνικά και στα Αγγλικά. Η αλλαγή γλώσσας διατηρεί την ίδια πρόοδο και το ιστορικό επαναλήψεων.',
  savedOnDevice: 'Αποθηκευμένα στη συσκευή',
  autosaveBody:
    'Το Psych Flash αποθηκεύει αυτόματα καθώς μελετάτε: πρόοδο θεμάτων, αξιολογήσεις και ημερομηνίες επανάληψης, θέση στην τρέχουσα συνεδρία, κατάσταση πλοήγησης, ρυθμίσεις πλάνου μελέτης και επιλογή γλώσσας.',
  backupIncludes:
    'Το αντίγραφο ασφαλείας περιλαμβάνει την παραπάνω αποθηκευμένη κατάσταση, τις ενεργές συνεδρίες και τον προγραμματισμό διαστηματικής επανάληψης.',
  localProgress: 'Αντίγραφο ασφαλείας και επαναφορά',
  noCloud:
    'Δεν υπάρχει συγχρονισμός cloud. Η διαγραφή των δεδομένων αυτού του ιστότοπου από τον browser αφαιρεί την αποθηκευμένη κατάσταση της συσκευής. Εξάγετε αντίγραφο πριν από αντικατάσταση ή διαγραφή.',
  exportProgress: 'Εξαγωγή αντιγράφου JSON',
  importProgress: 'Εισαγωγή αντιγράφου JSON',
  replacePrompt:
    'Αντικατάσταση όλης της τοπικά αποθηκευμένης κατάστασης με αυτό το αντίγραφο ({topics} εγγραφές θεμάτων και {reviews} συμβάντα επανάληψης);',
  replaceProgress: 'Αντικατάσταση τοπικής κατάστασης',
  cancelImport: 'Ακύρωση εισαγωγής',
  backupExported:
    'Το αντίγραφο ασφαλείας εξήχθη. Φυλάξτε το αρχείο σε ασφαλές σημείο.',
  exportFailed: 'Η εξαγωγή απέτυχε. Η αποθηκευμένη κατάσταση δεν άλλαξε.',
  backupTooLarge:
    'Το αντίγραφο ασφαλείας υπερβαίνει το όριο εισαγωγής των 50 MB.',
  invalidBackup: 'Μη έγκυρο αντίγραφο ασφαλείας.',
  backupImported:
    'Το αντίγραφο εισήχθη. Οι συνεδρίες, η πρόοδος και οι προτιμήσεις αποκαταστάθηκαν.',
  importFailed: 'Η εισαγωγή απέτυχε.',
  disclaimer:
    'Εκπαιδευτικό υλικό επανάληψης, όχι εργαλείο συνταγογράφησης ή κλινικής απόφασης. Η κλινική/βιβλιογραφική ανασκόπηση εκκρεμεί.',
}

const messages: Record<Locale, Record<Key, string>> = { en, el }

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: Key, params?: Record<string, string | number>) => string
}

const Context = createContext<I18nValue | null>(null)

const isLocale = (value: unknown): value is Locale =>
  value === 'en' || value === 'el'

export function I18nProvider({ children, db, initialLocale = 'el' }: {
  children: ReactNode
  db: PsychFlashDatabase
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const localeRef = useRef(locale)
  useEffect(() => {
    localeRef.current = initialLocale
    setLocaleState(initialLocale)
  }, [initialLocale])
  const setLocale = useCallback((next: Locale) => {
    if (localeRef.current === next) return
    localeRef.current = next
    setLocaleState(next)
    void journal(() => db.settings.put({ key: 'locale', value: next }), db)
      .then(() => window.dispatchEvent(new CustomEvent('psych-study-sync-request', { detail: db.name })))
      .catch(() => undefined)
  }, [db])
  const value = useMemo<I18nValue>(() => {
    const t = (key: Key, params: Record<string, string | number> = {}) =>
      Object.entries(params).reduce(
        (text, [name, value]) =>
          text.replaceAll('{' + name + '}', String(value)),
        messages[locale][key],
      )
    return { locale, setLocale, t }
  }, [locale, setLocale])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n() {
  const value = useContext(Context)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
