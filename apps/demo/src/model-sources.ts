export type ModelSourceKey = "default" | "huggingface" | "modelscope";

export interface ModelSourceOption {
  readonly available: boolean;
  readonly disabledReason?: Readonly<{ en: string; zh: string }>;
  readonly key: ModelSourceKey;
  readonly label: Readonly<{ en: string; zh: string }>;
  readonly manifestUrl?: string;
}

export type DemoModelSelection = Readonly<{ manifestUrl: string }>;
export type DemoModelPreset = "medium" | "small" | "tiny";
export type DemoRuntimeModel = Readonly<{
  det: DemoModelPreset | DemoModelSelection;
  rec: DemoModelPreset | DemoModelSelection;
}>;

export const DEFAULT_MODEL_SOURCE: ModelSourceKey = "default";

export const MODEL_SOURCE_OPTIONS: readonly ModelSourceOption[] = [
  {
    available: true,
    key: "default",
    label: { en: "SDK default", zh: "SDK 默认" }
  },
  {
    available: true,
    key: "huggingface",
    label: { en: "Hugging Face", zh: "Hugging Face" },
    manifestUrl: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/9286e2c113f4ad1980d39efc3838f8bfb83b2173/1.0.0/manifest.json"
  },
  {
    available: true,
    key: "modelscope",
    label: { en: "ModelScope", zh: "ModelScope" },
    manifestUrl: "https://modelscope.cn/models/chenmohan/web-sdk-pp-ocrv6/resolve/v1.0.0/1.0.0/manifest.json"
  }
] as const;

export function selectionToModel(source: ModelSourceKey): DemoModelSelection | undefined {
  const manifestUrl = MODEL_SOURCE_OPTIONS.find((option) => option.key === source)?.manifestUrl;
  return manifestUrl === undefined ? undefined : { manifestUrl };
}

export function runtimeModelForSelection(
  source: ModelSourceKey,
  det: DemoModelPreset,
  rec: DemoModelPreset,
  customManifestUrl: string,
): DemoRuntimeModel | undefined {
  const trimmedManifestUrl = customManifestUrl.trim();
  const remote =
    trimmedManifestUrl === ""
      ? selectionToModel(source)
      : { manifestUrl: trimmedManifestUrl };
  if (remote !== undefined) return { det: remote, rec: remote };
  return det === "small" && rec === "small" ? undefined : { det, rec };
}
