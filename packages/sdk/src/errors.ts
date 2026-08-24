export const ERROR_CODES = ["INVALID_MANIFEST", "CAPABILITY_UNSUPPORTED", "INVALID_INPUT", "MODEL_DOWNLOAD_FAILED", "MODEL_INTEGRITY_FAILED", "OUT_OF_MEMORY", "SESSION_CREATE_FAILED", "INFERENCE_FAILED", "ABORTED", "DISPOSED"] as const;
export type ErrorCode = typeof ERROR_CODES[number];
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | readonly JSONValue[] | { readonly [key: string]: JSONValue };
export type ErrorDetails = Readonly<Record<string, JSONValue>>;

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeJSONValue(value: unknown, seen: Set<object>): JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw new TypeError("Error details must not contain non-finite numbers");
  }
  if (typeof value !== "object" || value === undefined) throw new TypeError("Error details must contain only JSON values");
  if (seen.has(value)) throw new TypeError("Error details must not contain cycles");
  seen.add(value);
  if (Array.isArray(value)) {
    const normalized = Object.freeze(value.map((item) => normalizeJSONValue(item, seen)));
    seen.delete(value);
    return normalized;
  }
  if (!isPlainRecord(value)) throw new TypeError("Error details must contain only plain objects and arrays");
  const normalized: Record<string, JSONValue> = {};
  for (const key of Object.keys(value).sort()) {
    Object.defineProperty(normalized, key, { enumerable: true, value: normalizeJSONValue(value[key], seen) });
  }
  seen.delete(value);
  return Object.freeze(normalized);
}

function normalizeErrorDetails(details: ErrorDetails | undefined): ErrorDetails | undefined {
  if (details === undefined) return undefined;
  const normalized = normalizeJSONValue(details, new Set());
  if (normalized === null || Array.isArray(normalized) || typeof normalized !== "object") {
    throw new TypeError("Error details must be an object");
  }
  return normalized as ErrorDetails;
}
export class PPOCRv6Error extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails | undefined;
  constructor(code: ErrorCode, message?: string, details?: ErrorDetails) {
    super(message ?? code);
    const normalizedDetails = normalizeErrorDetails(details);
    this.name = "PPOCRv6Error";
    this.code = code;
    this.details = normalizedDetails;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON(): { name: string; code: ErrorCode; message: string; details?: ErrorDetails } {
    return this.details === undefined
      ? { name: this.name, code: this.code, message: this.message }
      : { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}
