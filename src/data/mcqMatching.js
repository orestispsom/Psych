import importedMatchingSets from "./mcqMatchingImported.js";
import curatedMatchingSets from "./mcqMatchingCurated.js";

// Keep source-imported EMQs separate from app-authored curated learning sets.
const mcqMatchingSets = [...importedMatchingSets, ...curatedMatchingSets];

export default mcqMatchingSets;
