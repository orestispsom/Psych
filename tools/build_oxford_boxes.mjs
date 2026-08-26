import { readFile, writeFile } from "node:fs/promises";

async function loadBatch(num) {
  const content = await readFile(new URL(`oxford_batch${num}.json`, import.meta.url), "utf8");
  return JSON.parse(content);
}

const rawContent = await readFile(new URL("oxford_raw.json", import.meta.url), "utf8");
const rawBoxes = JSON.parse(rawContent);
const rawOrder = rawBoxes.map(b => b.id);

const [b1, b2, b3, b4, b5] = await Promise.all([
  loadBatch(1),
  loadBatch(2),
  loadBatch(3),
  loadBatch(4),
  loadBatch(5)
]);

const allBoxes = [...b1, ...b2, ...b3, ...b4, ...b5];
const boxMap = new Map();
for (const box of allBoxes) {
  boxMap.set(box.id, box);
}

console.log(`Total unique boxes in map: ${boxMap.size}`);

// Order according to raw order
const orderedBoxes = [];
for (const id of rawOrder) {
  if (boxMap.has(id)) {
    orderedBoxes.push(boxMap.get(id));
  } else {
    console.error(`Missing box in map: ${id}`);
  }
}

console.log(`Ordered boxes total: ${orderedBoxes.length}`);

// Generate ESM file
const fileContent = `export const oxfordBoxes = ${JSON.stringify(orderedBoxes, null, 2)};\n`;

await writeFile(new URL("../src/data/oxfordBoxes.js", import.meta.url), fileContent, "utf8");
console.log("Successfully wrote src/data/oxfordBoxes.js!");
