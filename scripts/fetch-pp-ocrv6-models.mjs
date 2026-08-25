#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCharacterDictionary } from "./pp-ocrv6-dictionary.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const modelRoot = path.join(repoRoot, "models", "pp-ocrv6", "1.0.0");
const sourcePath = path.join(modelRoot, "model-source.json");
const manifestPath = path.join(modelRoot, "manifest.json");
const requiredFiles = ["inference.onnx", "inference.json", "inference.yml"];

function parseArgs(argv) {
  const revisions = new Map();
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--force") {
      force = true;
      continue;
    }
    if (argument !== "--revision") throw new Error("Usage: node scripts/fetch-pp-ocrv6-models.mjs --revision <asset-id=commit-sha> [... --revision <asset-id=commit-sha>] [--force]");
    const value = argv[++index] ?? "";
    const separator = value.indexOf("=");
    if (separator <= 0) throw new Error(`Invalid revision '${value}'. Use <asset-id=commit-sha>.`);
    const id = value.slice(0, separator);
    const revision = value.slice(separator + 1);
    if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error(`Revision for ${id} must be a 40-character commit SHA.`);
    revisions.set(id, revision);
  }
  if (revisions.size === 0) throw new Error("A fixed --revision asset-id=commit-sha is required; floating branches are refused.");
  return { revisions, force };
}

async function exists(filePath) {
  try { await readFile(filePath); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function validateFile(destination, expected, label) {
  const bytes = await readFile(destination);
  if (expected?.bytes !== undefined && bytes.byteLength !== expected.bytes) throw new Error(`${label} existing file has ${bytes.byteLength} bytes; expected ${expected.bytes}. Refusing to relabel stale content.`);
  if (expected?.sha256 !== undefined) {
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== expected.sha256.toLowerCase()) throw new Error(`${label} existing file sha256 ${hash} does not match expected ${expected.sha256}. Refusing to relabel stale content.`);
  }
  return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function download(url, destination, force, expected, label) {
  if (!force && await exists(destination)) {
    if (!expected?.bytes || !expected?.sha256) throw new Error(`${label} already exists without expected bytes and sha256. Refusing to relabel unverified content; use --force to refresh it.`);
    const integrity = await validateFile(destination, expected, label);
    return { status: "existing", ...integrity };
  }
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed (${response.status}) ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(destination, bytes);
  const integrity = await validateFile(destination, expected, label);
  return { status: "downloaded", ...integrity };
}

const { revisions, force } = parseArgs(process.argv.slice(2));
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestAssets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
for (const asset of source.assets) {
  const revision = revisions.get(asset.id);
  if (!revision) throw new Error(`Missing fixed --revision for ${asset.id}.`);
  if (revision.toLowerCase() !== asset.revision.toLowerCase()) throw new Error(`Revision mismatch for ${asset.id}: source records ${asset.revision}, received ${revision}.`);

  const metadataDir = path.join(modelRoot, "metadata", asset.id);
  await mkdir(metadataDir, { recursive: true });
  const baseUrl = `https://huggingface.co/${asset.repository}/resolve/${revision}`;
  const records = [];
  for (const filename of requiredFiles) {
    const destination = filename === "inference.onnx"
      ? path.join(modelRoot, `${asset.id}.onnx`)
      : path.join(metadataDir, filename);
    const expected = filename === "inference.onnx" ? manifestAssets.get(asset.id) : undefined;
    const result = await download(`${baseUrl}/${filename}?download=true`, destination, force, expected, `${asset.id}/${filename}`);
    records.push({ filename, url: `${baseUrl}/${filename}`, destination: path.relative(repoRoot, destination), ...result });
  }

  const yml = await readFile(path.join(metadataDir, "inference.yml"), "utf8");
  if (asset.role === "rec") {
    const characters = extractCharacterDictionary(yml, { useSpaceChar: true });
    if (characters.length === 0) throw new Error(`No character_dict found in ${asset.id} inference.yml.`);
    const dictionaryPath = path.join(modelRoot, "dictionaries", `${asset.id}.txt`);
    await mkdir(path.dirname(dictionaryPath), { recursive: true });
    if (force || !(await exists(dictionaryPath))) await writeFile(dictionaryPath, `${characters.join("\n")}\n`, "utf8");
    records.push({ filename: "dictionary", destination: path.relative(repoRoot, dictionaryPath), characters: characters.length });
  }
  await writeFile(path.join(metadataDir, "source.json"), `${JSON.stringify({ ...asset, revision, files: records }, null, 2)}\n`, "utf8");
  console.log(`${asset.id}: ${records.map((record) => record.status ?? "generated").join(", ")}`);
}
