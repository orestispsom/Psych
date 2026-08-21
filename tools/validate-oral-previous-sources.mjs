import { readFile } from "node:fs/promises";

async function importSourceModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return (await import(url)).default;
}

const [oralData, crucialQuestions, oralPreviousQuestionSources] = await Promise.all([
  importSourceModule("../src/data/oral.js"),
  importSourceModule("../src/data/crucialQuestionsContent.js"),
  importSourceModule("../src/data/oralPreviousQuestionSources.js"),
]);

const oralQuestions = oralData.flatMap(gravity =>
  (gravity.topics || []).flatMap(topic =>
    (topic.subtopics || [topic]).flatMap(section => section.questions || [])
  )
);
const oralIds = new Set(oralQuestions.map(question => question.id));
const sourceIds = new Set(crucialQuestions.map(question => question.id));
const mappedIds = new Set(Object.keys(oralPreviousQuestionSources));
const missingMappings = [...oralIds].filter(id => !mappedIds.has(id));
const unknownMappings = [...mappedIds].filter(id => !oralIds.has(id));
const missingSources = Object.entries(oralPreviousQuestionSources).flatMap(([questionId, refs]) =>
  refs.filter(ref => !sourceIds.has(ref)).map(ref => `${questionId}:${ref}`)
);

if (oralIds.size !== oralQuestions.length) {
  throw new Error(`Duplicate oral question IDs: ${oralQuestions.length - oralIds.size}`);
}
if (missingMappings.length || unknownMappings.length || missingSources.length) {
  throw new Error(JSON.stringify({ missingMappings, unknownMappings, missingSources }, null, 2));
}

console.log(
  `Validated ${oralQuestions.length} oral questions, ${mappedIds.size} mappings, ` +
  `${sourceIds.size} source chapters.`
);
