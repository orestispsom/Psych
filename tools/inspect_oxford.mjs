import { readFile } from "node:fs/promises";

async function importSourceModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const mod = await import(url);
  return mod.oxfordBoxes || mod.default || [];
}

const oxfordBoxes = await importSourceModule("../src/data/oxfordBoxes.js");
console.log(`Total Oxford boxes: ${oxfordBoxes.length}`);

let fullyGreek = 0;
let englishOrMixed = 0;
const listToTranslate = [];

for (let i = 0; i < oxfordBoxes.length; i++) {
  const box = oxfordBoxes[i];
  const str = JSON.stringify(box);
  const greekLetters = (str.match(/[\u0370-\u03ff\u1f00-\u1fff]/g) || []).length;
  const englishLetters = (str.match(/[a-zA-Z]/g) || []).length;
  
  // Calculate English ratio
  const ratio = englishLetters / (greekLetters + englishLetters + 1);
  if (ratio > 0.3) {
    englishOrMixed++;
    listToTranslate.push({
      index: i,
      id: box.id,
      chapter: box.chapter,
      boxNumber: box.boxNumber,
      title: box.title,
      ratio: ratio.toFixed(2),
      sample: str.slice(0, 100)
    });
  } else {
    fullyGreek++;
  }
}

console.log(`Fully Greek boxes: ${fullyGreek}`);
console.log(`English or Mixed boxes: ${englishOrMixed}`);

console.log("\nBoxes to translate/review:");
for (let i = 0; i < listToTranslate.length; i++) {
  const item = listToTranslate[i];
  console.log(`${i+1}. [Index ${item.index}] ID: ${item.id} | Ch ${item.chapter} Box ${item.boxNumber} | "${item.title}" | Eng Ratio: ${item.ratio}`);
}
