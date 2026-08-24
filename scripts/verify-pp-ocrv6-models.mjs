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

function readVarint(bytes, state) {
  let value = 0n;
  let shift = 0n;
  while (state.offset < bytes.length) {
    const byte = bytes[state.offset++];
    value |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return value;
    shift += 7n;
  }
  throw new Error("truncated protobuf varint");
}

function visitFields(bytes, visitor) {
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const id = tag >>> 3;
    const wire = tag & 7;
    if (wire === 0) visitor(id, wire, readVarint(bytes, state));
    else if (wire === 2) {
      const length = Number(readVarint(bytes, state));
      const end = state.offset + length;
      if (end > bytes.length) throw new Error("truncated protobuf message");
      visitor(id, wire, bytes.subarray(state.offset, end));
      state.offset = end;
    } else if (wire === 1) {
      visitor(id, wire, bytes.subarray(state.offset, state.offset + 8));
      state.offset += 8;
    } else if (wire === 5) {
      visitor(id, wire, bytes.subarray(state.offset, state.offset + 4));
      state.offset += 4;
    } else throw new Error(`unsupported protobuf wire type ${wire}`);
  }
}

function tensorParameterCount(bytes) {
  const dims = [];
  visitFields(bytes, (id, wire, value) => {
    if (id !== 1) return;
    if (wire === 0) dims.push(Number(BigInt.asIntN(64, value)));
    if (wire === 2) {
      const state = { offset: 0 };
      while (state.offset < value.length) dims.push(Number(BigInt.asIntN(64, readVarint(value, state))));
    }
  });
  if (dims.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error(`invalid initializer dimensions ${dims.join(",")}`);
  return dims.reduce((product, value) => product * value, 1);
}

function inspectModel(bytes) {
  let opset;
  let parameterCount = 0;
  let initializerCount = 0;
  visitFields(bytes, (id, wire, value) => {
    if (id === 8 && wire === 2) visitFields(value, (setId, setWire, setValue) => {
      if (setId === 2 && setWire === 0) opset = Number(setValue);
    });
    if (id === 7 && wire === 2) visitFields(value, (graphId, graphWire, graphValue) => {
      if (graphId === 5 && graphWire === 2) {
        initializerCount += 1;
        parameterCount += tensorParameterCount(graphValue);
      }
    });
  });
  return { opset, parameterCount, initializerCount };
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
    if (typeof value !== "number" && (typeof actual[index] !== "string" || actual[index].length === 0 || actual[index] === "*")) errors.push(`${label}[${index}]: expected a preserved symbolic dimension, observed ${actual[index]}`);
  });
}

async function verifyAsset(asset) {
  const errors = [];
  const filePath = path.join(modelRoot, asset.file);
  const bytes = await readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assertEqual(bytes.byteLength, asset.bytes, `${asset.id}.bytes`, errors);
  assertEqual(hash, asset.sha256, `${asset.id}.sha256`, errors);
  const model = inspectModel(bytes);
  assertEqual(model.opset, asset.opset, `${asset.id}.opset`, errors);
  assertEqual(model.parameterCount, asset.parameterCount, `${asset.id}.parameterCount`, errors);

  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  try {
    const input = session.inputMetadata.find((metadata) => metadata.name === asset.input.name);
    const output = session.outputMetadata.find((metadata) => metadata.name === asset.output.name);
    if (!input) errors.push(`${asset.id}.input.name: ${asset.input.name} not found in ${session.inputNames.join(",")}`);
    if (!output) errors.push(`${asset.id}.output.name: ${asset.output.name} not found in ${session.outputNames.join(",")}`);
    if (input) {
      assertEqual(input.type, asset.input.dtype, `${asset.id}.input.dtype`, errors);
      assertShape(input.shape, asset.input.shape, `${asset.id}.input.shape`, errors);
    }
    if (output) {
      assertEqual(output.type, asset.output.dtype, `${asset.id}.output.dtype`, errors);
      assertShape(output.shape, asset.output.shape, `${asset.id}.output.shape`, errors);
    }
  } finally {
    await session.release();
  }

  if (asset.decoder) {
    const dictionary = await readFile(path.join(modelRoot, asset.decoder.dictionary), "utf8");
    const entries = dictionary.split(/\r?\n/).filter(Boolean);
    assertEqual(entries.length, asset.decoder.dictionaryEntries, `${asset.id}.dictionaryEntries`, errors);
  }
  return {
    id: asset.id,
    bytes: bytes.byteLength,
    sha256: hash,
    opset: model.opset,
    parameterCount: model.parameterCount,
    inputNames: session.inputNames,
    outputNames: session.outputNames,
    inputs: session.inputMetadata.map(({ name, type, shape }) => ({ name, type, shape })),
    outputs: session.outputMetadata.map(({ name, type, shape }) => ({ name, type, shape })),
    errors,
  };
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
