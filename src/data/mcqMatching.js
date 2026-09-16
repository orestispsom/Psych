import translatedMatchingSets from "./mcqMatchingGreek.js";
import curatedMatchingSets from "./mcqMatchingCurated.js";

// The imported English bank remains in mcqMatchingImported.js as source/provenance.
// Learner-facing matching questions use the reviewed Greek translation plus
// app-authored curated Greek learning sets.
const mcqMatchingSets = [...translatedMatchingSets, ...curatedMatchingSets];

export default mcqMatchingSets;
