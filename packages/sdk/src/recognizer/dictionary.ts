import { PPOCRv6Error } from "../errors";
import type { RuntimeManifestAsset } from "../model/manifest";

const invalid = (message: string): PPOCRv6Error => new PPOCRv6Error("INVALID_MANIFEST", message);

export function validateRecognitionDictionary(asset: RuntimeManifestAsset, dictionary: readonly string[]): readonly string[] {
  const decoder = asset.decoder ?? {};
  const declaredEntries = decoder.dictionaryEntries;
  if (declaredEntries !== undefined && (typeof declaredEntries !== "number" || !Number.isSafeInteger(declaredEntries) || declaredEntries < 0)) {
    throw invalid(`${asset.id}.decoder.dictionaryEntries must be a non-negative integer`);
  }
  if (typeof declaredEntries === "number" && declaredEntries !== dictionary.length) {
    throw invalid(`${asset.id} dictionary has ${dictionary.length} entries but decoder.dictionaryEntries declares ${declaredEntries}`);
  }

  const classCount = asset.output.shape.at(-1);
  if (typeof classCount !== "number") return dictionary;
  if (!Number.isSafeInteger(classCount) || classCount < 2) throw invalid(`${asset.id}.output.shape must declare at least two recognition classes`);
  const blankIndex = decoder.blankIndex ?? 0;
  if (typeof blankIndex !== "number" || !Number.isSafeInteger(blankIndex) || blankIndex < 0 || blankIndex >= classCount) throw invalid(`${asset.id}.decoder.blankIndex must identify a valid output class`);
  const expectedEntries = classCount - 1;
  if (dictionary.length !== expectedEntries) throw invalid(`${asset.id} dictionary has ${dictionary.length} entries but output declares ${expectedEntries} non-blank classes`);
  return dictionary;
}
