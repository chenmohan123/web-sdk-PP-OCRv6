#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-web";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const modelRoot = path.join(repoRoot, "models", "pp-ocrv6", "1.0.0");
const manifestPath = path.join(modelRoot, "manifest.json");

function normalizeShape(shape) {
  return [...shape].map((value) => typeof value === "number" ? value : "*");
}

function assertEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}, observed ${actual}`);
}

function assertShape(actual, expected, label, errors) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    errors.push(`${label}: expected rank ${expected.length}, observed ${JSON.stringify(actual)}`);
    return;
  }
  expected.forEach((value, index) => {
    if (typeof value === "number" && actual[index] !== value) errors.push(`${label}[${index}]: expected ${value}, observed ${actual[index]}`);
  });
}

async function verifyAsset(asset) {
  const errors = [];
  const filePath = path.join(modelRoot, asset.file);
  const bytes = await readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assertEqual(bytes.byteLength, asset.bytes, `${asset.id}.bytes`, errors);
  assertEqual(hash, asset.sha256, `${asset.id}.sha256`, errors);

  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  try {
    const input = session.inputMetadata.find((metadata) => metadata.name === asset.input.name);
    const output = session.outputMetadata.find((metadata) => metadata.name === asset.output.name);
    if (!input) errors.push(`${asset.id}.input.name: ${asset.input.name} not found in ${session.inputNames.join(",")}`);
    if (!output) errors.push(`${asset.id}.output.name: ${asset.output.name} not found in ${session.outputNames.join(",")}`);
    if (input) {
      assertEqual(input.type, asset.input.dtype, `${asset.id}.input.dtype`, errors);
      assertShape(normalizeShape(input.shape), asset.input.shape.map((value) => typeof value === "number" ? value : "*"), `${asset.id}.input.shape`, errors);
    }
    if (output) {
      assertEqual(output.type, asset.output.dtype, `${asset.id}.output.dtype`, errors);
      assertShape(normalizeShape(output.shape), asset.output.shape.map((value) => typeof value === "number" ? value : "*"), `${asset.id}.output.shape`, errors);
    }
  } finally {
    await session.release();
  }

  if (asset.decoder) {
    const dictionary = await readFile(path.join(modelRoot, asset.decoder.dictionary), "utf8");
    const entries = dictionary.split(/\r?\n/).filter(Boolean);
    assertEqual(entries.length, asset.decoder.dictionaryEntries, `${asset.id}.dictionaryEntries`, errors);
  }
  return { id: asset.id, bytes: bytes.byteLength, sha256: hash, inputNames: session.inputNames, outputNames: session.outputNames, errors };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const results = [];
for (const asset of manifest.assets) {
  try {
    results.push(await verifyAsset(asset));
  } catch (error) {
    results.push({ id: asset.id, errors: [error.message] });
  }
}
const report = { manifest: path.relative(repoRoot, manifestPath), verifiedAt: new Date().toISOString(), assets: results, ok: results.every((result) => result.errors?.length === 0) };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--report")) await writeFile(path.join(modelRoot, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (!report.ok) process.exitCode = 1;
