import type { OCRProgress, OCRProgressComponent } from "./types";

export type ProgressSource = "cache" | "network";
export type ProgressCallback = (event: OCRProgress) => void;

interface ProgressEntry {
  readonly totalBytes: number;
  source?: ProgressSource;
  loadedBytes: number;
}

export interface ProgressReporter {
  register(component: OCRProgressComponent, totalBytes: number): void;
  markSource(component: OCRProgressComponent, source: ProgressSource): void;
  emit(component: OCRProgressComponent, event: Omit<OCRProgress, "component">): void;
}

export const safeEmitProgress = (callback: ProgressCallback | undefined, event: OCRProgress): void => {
  if (callback === undefined) return;
  try { callback(event); } catch { /* 用户回调异常不能中断 runtime。 */ }
};

export function createProgressReporter(callback: ProgressCallback | undefined, components: readonly OCRProgressComponent[]): ProgressReporter {
  const entries = new Map<OCRProgressComponent, ProgressEntry>();
  for (const component of components) entries.set(component, { totalBytes: 0, loadedBytes: 0 });
  return {
    register(component, totalBytes) {
      entries.set(component, { totalBytes: Math.max(0, totalBytes), loadedBytes: 0 });
    },
    markSource(component, source) {
      const entry = entries.get(component);
      if (entry) entry.source = source;
    },
    emit(component, event) {
      const entry = entries.get(component);
      if (event.phase !== "download") {
        safeEmitProgress(callback, { ...event, component });
        return;
      }
      if (entry === undefined) {
        safeEmitProgress(callback, { ...event, component });
        return;
      }
      entry.source = "network";
      if (typeof event.loadedBytes === "number") entry.loadedBytes = Math.max(entry.loadedBytes, event.loadedBytes);
      else if (typeof event.progress === "number") entry.loadedBytes = Math.round(entry.totalBytes * Math.min(Math.max(event.progress, 0), 1));
      const networkEntries = [...entries.values()].filter((candidate) => candidate.source === "network");
      const totalBytes = networkEntries.reduce((sum, candidate) => sum + candidate.totalBytes, 0);
      const loadedBytes = networkEntries.reduce((sum, candidate) => sum + candidate.loadedBytes, 0);
      const progress = totalBytes > 0 ? Math.min(loadedBytes / totalBytes, 1) : event.progress;
      safeEmitProgress(callback, { phase: "download", ...(progress === undefined ? {} : { progress }), loadedBytes, totalBytes });
    },
  };
}
