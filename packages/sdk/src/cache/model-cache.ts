export interface ModelCacheIdentity {
  readonly modelId: string;
  readonly version: string;
  readonly variant: string;
  readonly sha256: string;
}
export interface ModelCache {
  get(identity: ModelCacheIdentity): Promise<Uint8Array | undefined>;
  set(identity: ModelCacheIdentity, bytes: Uint8Array): Promise<void>;
  list(): Promise<readonly ModelCacheIdentity[]>;
  estimate?(): Promise<{ readonly usage?: number; readonly quota?: number }>;
  clearCurrent(modelId: string, version: string): Promise<void>;
  clearAll(): Promise<void>;
}
