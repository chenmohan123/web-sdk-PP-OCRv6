import { PPOCRv6Error } from "../errors";

export type TensorShape = readonly (number | string)[];
export interface TensorContract {
  readonly name: string;
  readonly dtype: string;
  readonly shape: TensorShape;
}
export interface RuntimeManifestAsset {
  readonly id: string;
  readonly role: "det" | "rec";
  readonly bytes: number;
  readonly sha256: string;
  readonly url: string;
  readonly input: TensorContract;
  readonly output: TensorContract;
  readonly preprocessing: Record<string, unknown>;
  readonly postprocessing?: Record<string, unknown>;
  readonly decoder?: Record<string, unknown>;
  readonly [key: string]: unknown;
}
export interface RuntimeManifest {
  readonly modelId: string;
  readonly version: string;
  readonly assets: readonly RuntimeManifestAsset[];
  readonly [key: string]: unknown;
}

const invalid = (message: string): PPOCRv6Error => new PPOCRv6Error("INVALID_MANIFEST", message);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function tensorContract(value: unknown, label: string): TensorContract {
  if (!record(value) || typeof value.name !== "string" || !value.name || typeof value.dtype !== "string" || !value.dtype || !Array.isArray(value.shape)) throw invalid(`${label} must define name, dtype, and shape`);
  const shape = value.shape as unknown[];
  if (shape.length === 0 || shape.some((dimension) => !(typeof dimension === "string" && dimension.length > 0) && !(typeof dimension === "number" && Number.isInteger(dimension) && dimension > 0))) throw invalid(`${label}.shape must contain positive dimensions or symbolic names`);
  return { name: value.name, dtype: value.dtype, shape: shape as TensorShape };
}

function resolveUrl(value: unknown, baseUrl: string | undefined, label: string): string {
  if (typeof value !== "string" || !value) throw invalid(`${label}.url must be a URL`);
  try { return new URL(value, baseUrl).toString(); } catch { throw invalid(`${label}.url must be absolute or resolvable against a base URL`); }
}

export function parseRuntimeManifest(value: unknown, baseUrl?: string): RuntimeManifest {
  if (!record(value) || typeof value.modelId !== "string" || !value.modelId || typeof value.version !== "string" || !value.version || !Array.isArray(value.assets) || value.assets.length === 0) throw invalid("manifest must define modelId, version, and a non-empty assets array");
  const assets = value.assets.map((raw, index) => {
    const label = `assets[${index}]`;
    if (!record(raw) || typeof raw.id !== "string" || !raw.id || (raw.role !== "det" && raw.role !== "rec") || typeof raw.bytes !== "number" || !Number.isSafeInteger(raw.bytes) || raw.bytes <= 0) throw invalid(`${label} must define id, role, and positive integer bytes`);
    if (typeof raw.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(raw.sha256)) throw invalid(`${label}.sha256 must be a 64-character hexadecimal digest`);
    const input = tensorContract(raw.input, `${label}.input`);
    const output = tensorContract(raw.output, `${label}.output`);
    if (!record(raw.preprocessing)) throw invalid(`${label}.preprocessing is required`);
    if (raw.role === "det" && !record(raw.postprocessing)) throw invalid(`${label}.postprocessing is required for detection assets`);
    if (raw.role === "rec" && !record(raw.decoder)) throw invalid(`${label}.decoder is required for recognition assets`);
    return {
      ...raw,
      id: raw.id,
      role: raw.role,
      bytes: raw.bytes,
      sha256: raw.sha256.toLowerCase(),
      url: resolveUrl(raw.url, baseUrl, label),
      input,
      output,
      preprocessing: raw.preprocessing as Record<string, unknown>,
      ...(raw.postprocessing === undefined ? {} : { postprocessing: raw.postprocessing as Record<string, unknown> }),
      ...(raw.decoder === undefined ? {} : { decoder: raw.decoder as Record<string, unknown> }),
    } as RuntimeManifestAsset;
  });
  return { ...value, modelId: value.modelId, version: value.version, assets } as RuntimeManifest;
}
