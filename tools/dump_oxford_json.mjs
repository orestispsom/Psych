import { readFile, writeFile } from "node:fs/promises";

async function importSourceModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const mod = await import(url);
  return mod.oxfordBoxes || mod.default || [];
}

const oxfordBoxes = await importSourceModule("../src/data/oxfordBoxes.js");
console.log(`Loaded ${oxfordBoxes.length} boxes.`);

await writeFile(new URL("oxford_raw.json", import.meta.url), JSON.stringify(oxfordBoxes, null, 2), "utf8");
console.log("Saved tools/oxford_raw.json successfully!");
