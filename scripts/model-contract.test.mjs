import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const modelRoot = new URL("models/pp-ocrv6/1.0.0/", root);
const requiredIds = [
  "PP-OCRv6_medium_det",
  "PP-OCRv6_small_det",
  "PP-OCRv6_tiny_det",
  "PP-OCRv6_medium_rec",
  "PP-OCRv6_small_rec",
  "PP-OCRv6_tiny_rec",
];
const sha256 = /^[a-f0-9]{64}$/i;

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
    assert.match(asset.url, /^https:\/\//, `${asset.id} URL`);
    assert.match(asset.huggingFace.url, /^https:\/\//, `${asset.id} HF URL`);
    assert.match(asset.upstream.repository, /^PaddlePaddle\/PP-OCRv6_(?:medium|small|tiny)_(?:det|rec)_onnx$/);
    assert.ok(asset.upstream.revision, `${asset.id} upstream revision`);
    assert.ok(asset.input && asset.output, `${asset.id} tensor contract`);
    assert.ok(asset.preprocessing, `${asset.id} preprocessing`);
    assert.ok(asset.postprocessing || asset.decoder, `${asset.id} decode contract`);
  }
});

test("published SDK files exclude ONNX binaries", async () => {
  const packageJson = await readJson(new URL("packages/sdk/package.json", root));
  assert.deepEqual(packageJson.files, ["dist"]);
  assert.equal(packageJson.files.some((entry) => /\.onnx|models\//i.test(entry)), false);
});
