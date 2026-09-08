import type { InitializationTiming } from "./types";

export const emptyLoadTimings = { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0 };

export function currentLoadTimings(initialization: InitializationTiming | undefined, cold: boolean) {
  if (!cold || !initialization) return emptyLoadTimings;
  const { modelDownloadMs, modelCacheReadMs, integrityMs, sessionMs } = initialization;
  return { modelDownloadMs, modelCacheReadMs, integrityMs, sessionMs };
}

/** 并行初始化的分项为组件工作量之和，不作为墙钟时间相加。 */
export function sumInitialization(left?: InitializationTiming, right?: InitializationTiming): InitializationTiming | undefined {
  if (!left) return right;
  if (!right) return left;
  const source = left.source === right.source ? left.source : left.source && right.source ? "mixed" : undefined;
  return {
    modelDownloadMs: left.modelDownloadMs + right.modelDownloadMs,
    modelCacheReadMs: left.modelCacheReadMs + right.modelCacheReadMs,
    integrityMs: left.integrityMs + right.integrityMs,
    sessionMs: left.sessionMs + right.sessionMs,
    ...(source === undefined ? {} : { source }),
  };
}
