import part01 from "./mcqMatchingTranslated01.js";
import part02 from "./mcqMatchingTranslated02.js";
import part03 from "./mcqMatchingTranslated03.js";
import part04 from "./mcqMatchingTranslated04.js";
import part05 from "./mcqMatchingTranslated05.js";

const itemCorrections = {
  crash_course_match_01_03: {
    prompt: "Γυναίκα 22 ετών που άρχισε πρόσφατα αντιψυχωσικό βρίσκεται σωριασμένη στο δωμάτιό της, με ταχυκαρδία, υπόταση, μειωμένο επίπεδο συνείδησης και μυϊκή δυσκαμψία.",
  },
  crash_course_match_18_02: {
    prompt: "Εκπαιδευόμενος ηλεκτρολόγος 22 ετών συλλαμβάνεται να διαρρηγνύει κατάστημα για να πάρει εξαρτήματα για ένα «jetpack» που θα επαναστατικοποιήσει τις υπερατλαντικές πτήσεις. Έχει παραιτηθεί από την εργασία του, είναι ευερέθιστος και εμφανίζει σεξουαλική άρση αναστολών.",
  },
};

function applyFinalLanguageReview(set) {
  return {
    ...set,
    items: set.items.map(item => (
      itemCorrections[item.id] ? { ...item, ...itemCorrections[item.id] } : item
    )),
  };
}

const translatedMatchingSets = [
  ...part01,
  ...part02,
  ...part03,
  ...part04,
  ...part05,
].map(applyFinalLanguageReview);

export default translatedMatchingSets;
