import { readFile } from "node:fs/promises";

async function importSourceModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const mod = await import(url);
  return mod.oxfordBoxes || mod.default || [];
}

const oxfordBoxes = await importSourceModule("../src/data/oxfordBoxes.js");
console.log(`Total boxes: ${oxfordBoxes.length}`);

// Group by Chapter
const chapterMap = {};
for (const b of oxfordBoxes) {
  const ch = b.chapter || 0;
  if (!chapterMap[ch]) chapterMap[ch] = [];
  chapterMap[ch].push(b);
}

for (const [ch, boxes] of Object.entries(chapterMap)) {
  let engCount = 0;
  for (const b of boxes) {
    const str = JSON.stringify(b);
    const greekLetters = (str.match(/[\u0370-\u03ff\u1f00-\u1fff]/g) || []).length;
    const englishLetters = (str.match(/[a-zA-Z]/g) || []).length;
    if (englishLetters / (greekLetters + englishLetters + 1) > 0.3) {
      engCount++;
    }
  }
  console.log(`Chapter ${ch}: total ${boxes.length} boxes (${engCount} English/Mixed, ${boxes.length - engCount} Greek)`);
}
