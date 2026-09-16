import part01 from "./mcqMatchingGreekPart01.js";
import part02 from "./mcqMatchingGreekPart02.js";
import part03 from "./mcqMatchingGreekPart03.js";
import part04 from "./mcqMatchingGreekPart04.js";
import part05 from "./mcqMatchingGreekPart05.js";

// Small final-pass corrections are kept here so the large translated source
// chunks remain easy to audit against the imported English bank.
const itemCorrections = {
  crash_course_match_01_03: {
    prompt: "Γυναίκα 22 ετών που άρχισε πρόσφατα αντιψυχωσικό βρίσκεται σωριασμένη στο δωμάτιό της, με ταχυκαρδία, υπόταση, μειωμένο επίπεδο συνείδησης και μυϊκή δυσκαμψία.",
  },
  crash_course_match_18_02: {
    prompt: "Εκπαιδευόμενος ηλεκτρολόγος 22 ετών συλλαμβάνεται να διαρρηγνύει κατάστημα για να πάρει εξαρτήματα για ένα «jetpack» που, όπως πιστεύει, θα επαναστατικοποιήσει τις υπερατλαντικές πτήσεις. Έχει παραιτηθεί από την εργασία του, είναι ευερέθιστος και εμφανίζει σεξουαλική άρση αναστολών.",
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
