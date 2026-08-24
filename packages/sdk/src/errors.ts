export type ErrorCode = "INVALID_MANIFEST" | "CAPABILITY_UNSUPPORTED" | "INVALID_INPUT" | "MODEL_DOWNLOAD_FAILED" | "MODEL_INTEGRITY_FAILED" | "OUT_OF_MEMORY" | "SESSION_CREATE_FAILED" | "INFERENCE_FAILED" | "ABORTED" | "DISPOSED";
export type ErrorDetails = Readonly<Record<string, unknown>>;
export class PPOCRv6Error extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails | undefined;
  constructor(code: ErrorCode, message?: string, details?: ErrorDetails) {
    super(message ?? code);
    this.name = "PPOCRv6Error";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON(): { name: string; code: ErrorCode; message: string; details?: ErrorDetails } {
    return this.details === undefined
      ? { name: this.name, code: this.code, message: this.message }
      : { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}
