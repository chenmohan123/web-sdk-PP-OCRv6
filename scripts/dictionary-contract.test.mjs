import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractCharacterDictionary } from "./pp-ocrv6-dictionary.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(repoRoot, "models", "pp-ocrv6");

async function readDictionary(kind) {
  const file = path.join(modelRoot, "dictionaries", `PP-OCRv6_${kind}_rec.txt`);
  return (await readFile(file, "utf8")).replace(/\r/g, "").split("\n").filter((line) => line.length > 0);
}

for (const [kind, expectedLength, expectedSpaceIndex] of [["medium", 18709, 1748], ["small", 18709, 1748], ["tiny", 6905, 616]]) {
  test(`${kind} recognition dictionary preserves official Unicode indexes`, async () => {
    const yaml = await readFile(path.join(modelRoot, "metadata", `PP-OCRv6_${kind}_rec`, "inference.yml"), "utf8");
    const official = extractCharacterDictionary(yaml);
    const officialWithSpace = extractCharacterDictionary(yaml, { useSpaceChar: true });
    const generated = await readDictionary(kind);
    assert.equal(official.length + 1, expectedLength);
    assert.equal(officialWithSpace.length, expectedLength);
    assert.equal(generated.length, expectedLength);
    assert.equal(official[expectedSpaceIndex], "　");
    assert.equal(generated[expectedSpaceIndex], "　");
    assert.deepEqual(officialWithSpace, [...official, " "]);
    assert.deepEqual(generated, officialWithSpace);
    assert.equal(generated.at(-1), " ");
  });
}
