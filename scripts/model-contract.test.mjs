import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const modelRoot = new URL("models/pp-ocrv6/", root);
const requiredIds = [
  "PP-OCRv6_medium_det",
  "PP-OCRv6_small_det",
  "PP-OCRv6_tiny_det",
  "PP-OCRv6_medium_rec",
  "PP-OCRv6_small_rec",
  "PP-OCRv6_tiny_rec",
];
const sha256 = /^[a-f0-9]{64}$/i;
const revisionSha = /^[a-f0-9]{40}$/i;
const expectedParameterCounts = {
  "PP-OCRv6_medium_det": 15486640,
  "PP-OCRv6_small_det": 2453368,
  "PP-OCRv6_tiny_det": 428420,
  "PP-OCRv6_medium_rec": 19115263,
  "PP-OCRv6_small_rec": 5267732,
  "PP-OCRv6_tiny_rec": 1104524,
};
const expectedContracts = {
  "PP-OCRv6_medium_det": { opset: 14, input: { name: "x", dtype: "float32", shape: ["N", 3, "H", "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", 1, "H/4", "W/4"] } },
  "PP-OCRv6_small_det": { opset: 14, input: { name: "x", dtype: "float32", shape: ["N", 3, "H", "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", 1, "H/4", "W/4"] } },
  "PP-OCRv6_tiny_det": { opset: 14, input: { name: "x", dtype: "float32", shape: ["N", 3, "H", "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", 1, "H/4", "W/4"] } },
  "PP-OCRv6_medium_rec": { opset: 11, input: { name: "x", dtype: "float32", shape: ["N", 3, 48, "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", "T", 18710] } },
  "PP-OCRv6_small_rec": { opset: 11, input: { name: "x", dtype: "float32", shape: ["N", 3, 48, "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", "T", 18710] } },
  "PP-OCRv6_tiny_rec": { opset: 11, input: { name: "x", dtype: "float32", shape: ["N", 3, 48, "W"] }, output: { name: "fetch_name_0", dtype: "float32", shape: ["N", "T", 6906] } },
};

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("runtime manifest pins all official PP-OCRv6 assets", async () => {
  const manifest = await readJson(new URL("manifest.json", modelRoot));
  assert.equal(manifest.schemaVersion, "1.0.0");
  assert.equal(manifest.modelId, "pp-ocrv6");
  assert.equal(manifest.pipeline, "det-crop-rec");
  assert.deepEqual(
    manifest.assets.map((asset) => asset.id).sort(),
    requiredIds.sort(),
  );

  for (const asset of manifest.assets) {
    assert.ok(Number.isInteger(asset.bytes) && asset.bytes > 0, `${asset.id} bytes`);
    assert.match(asset.sha256, sha256, `${asset.id} sha256`);
    assert.equal(asset.precision, "fp32", `${asset.id} precision`);
    assert.equal(asset.url, asset.file, `${asset.id} root model URL`);
    assert.match(asset.huggingFace.url, /^https:\/\//, `${asset.id} upstream HF URL`);
    assert.match(asset.huggingFace.revision, revisionSha, `${asset.id} HF revision`);
    assert.match(asset.upstream.revision, revisionSha, `${asset.id} upstream revision`);
    assert.match(asset.huggingFace.url, new RegExp(`/resolve/${asset.huggingFace.revision}/`), `${asset.id} immutable HF URL`);
    assert.equal(asset.parameterCount, expectedParameterCounts[asset.id], `${asset.id} parameter count`);
    assert.equal(asset.opset, asset.role === "det" ? 14 : 11, `${asset.id} opset`);
    assert.deepEqual({ name: asset.input.name, dtype: asset.input.dtype, shape: asset.input.shape }, expectedContracts[asset.id].input, `${asset.id} input contract`);
    assert.deepEqual({ name: asset.output.name, dtype: asset.output.dtype, shape: asset.output.shape }, expectedContracts[asset.id].output, `${asset.id} output contract`);
    assert.match(asset.upstream.repository, /^PaddlePaddle\/PP-OCRv6_(?:medium|small|tiny)_(?:det|rec)_onnx$/);
    assert.equal(asset.upstream.revision, asset.huggingFace.revision, `${asset.id} provenance revision`);
    assert.ok(asset.input && asset.output, `${asset.id} tensor contract`);
    assert.ok(asset.preprocessing, `${asset.id} preprocessing`);
    assert.ok(asset.postprocessing || asset.decoder, `${asset.id} decode contract`);
  }
});

test("model source records immutable revisions and exact model metadata", async () => {
  const source = await readJson(new URL("model-source.json", modelRoot));
  assert.equal(source.assets.length, requiredIds.length);
  for (const asset of source.assets) {
    assert.match(asset.revision, revisionSha, `${asset.id} source revision`);
    assert.equal(asset.parameterCount, expectedParameterCounts[asset.id], `${asset.id} source parameter count`);
    assert.equal(asset.opset, expectedContracts[asset.id].opset, `${asset.id} source opset`);
  }
});

test("published SDK files exclude ONNX binaries", async () => {
  const packageJson = await readJson(new URL("packages/sdk/package.json", root));
  assert.deepEqual(packageJson.files, ["dist"]);
  assert.equal(packageJson.files.some((entry) => /\.onnx|models\//i.test(entry)), false);
});
