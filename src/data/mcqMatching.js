import translatedMatchingSets from "./mcqMatchingGreek.js";
import curatedMatchingSets from "./mcqMatchingCurated.js";
import { expandMatchingSetsWithBoardItems } from "./mcqMatchingBoardExpansion.js";

// The imported English bank remains in mcqMatchingImported.js as source/provenance.
// Learner-facing matching questions use the reviewed Greek translation, then add
// separately-authored high-yield board-revision stems only where an existing
// answer choice was previously unused. Curated Greek sets remain separate.
const expandedTranslatedSets = expandMatchingSetsWithBoardItems(translatedMatchingSets);
const mcqMatchingSets = [...expandedTranslatedSets, ...curatedMatchingSets];

export default mcqMatchingSets;
