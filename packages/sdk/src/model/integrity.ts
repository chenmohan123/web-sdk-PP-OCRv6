import { PPOCRv6Error } from "../errors";

export type HashFunction = (bytes: Uint8Array) => Promise<string>;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new PPOCRv6Error("MODEL_INTEGRITY_FAILED", "Web Crypto SHA-256 is unavailable");
  const digest = await subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyModelIntegrity(bytes: Uint8Array, expectedBytes: number, expectedSha256: string, hash: HashFunction = sha256Hex): Promise<void> {
  if (bytes.byteLength !== expectedBytes) throw new PPOCRv6Error("MODEL_INTEGRITY_FAILED", "Model byte length does not match manifest", { expectedBytes, actualBytes: bytes.byteLength });
  const actual = (await hash(bytes)).toLowerCase();
  if (actual !== expectedSha256.toLowerCase()) throw new PPOCRv6Error("MODEL_INTEGRITY_FAILED", "Model SHA-256 does not match manifest", { expectedSha256, actualSha256: actual });
}
