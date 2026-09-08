import type { RuntimeInfo } from "web-sdk-pp-ocrv6";
export function actualBackendLabel(runtime: Pick<RuntimeInfo, "actualBackend" | "componentBackends">): string {
  const components = runtime.componentBackends;
  if (!components) return runtime.actualBackend;
  return "DET: " + components.det + (components.rec === undefined ? "" : " / REC: " + components.rec);
}
