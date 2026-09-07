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
  estimate?(modelId?: string, version?: string): Promise<{ readonly usage?: number; readonly quota?: number }>;
  /** 在下载或 manifest 解析前捕获代次；旧实现可以继续只提供 set。 */
  createWriter?(): CacheWriter;
  clearCurrent(modelId: string, version: string): Promise<void>;
  clearAll(): Promise<void>;
}
export type CacheWriter = (identity: ModelCacheIdentity, bytes: Uint8Array) => Promise<void>;
