export interface DecodedText { readonly text: string; readonly score: number; }

const probabilityAt = (data: Float32Array, offset: number, classes: number, probabilities: boolean): { index: number; score: number } => {
  let index = 0;
  for (let classIndex = 1; classIndex < classes; classIndex += 1) if ((data[offset + classIndex] ?? -Infinity) > (data[offset + index] ?? -Infinity)) index = classIndex;
  if (probabilities) return { index, score: data[offset + index] ?? 0 };
  let maximum = -Infinity;
  for (let classIndex = 0; classIndex < classes; classIndex += 1) maximum = Math.max(maximum, data[offset + classIndex] ?? -Infinity);
  let sum = 0;
  for (let classIndex = 0; classIndex < classes; classIndex += 1) sum += Math.exp((data[offset + classIndex] ?? -Infinity) - maximum);
  return { index, score: Math.exp((data[offset + index] ?? -Infinity) - maximum) / sum };
};

export function decodeCTC(data: Float32Array, dims: readonly number[], dictionary: readonly string[], options: { readonly blankIndex?: number; readonly probabilities?: boolean } = {}): readonly DecodedText[] {
  const [batch, steps, classes] = dims;
  if (!batch || !steps || !classes) return [];
  const blank = options.blankIndex ?? 0;
  const results: DecodedText[] = [];
  for (let item = 0; item < batch; item += 1) {
    let previous = -1;
    let text = "";
    let confidence = 0;
    let count = 0;
    for (let step = 0; step < steps; step += 1) {
      const selected = probabilityAt(data, (item * steps + step) * classes, classes, options.probabilities ?? false);
      if (selected.index !== blank && selected.index !== previous) {
        const character = dictionary[selected.index > blank ? selected.index - 1 : selected.index];
        if (character !== undefined) { text += character; confidence += selected.score; count += 1; }
      }
      previous = selected.index;
    }
    results.push({ text, score: count === 0 ? 0 : confidence / count });
  }
  return results;
}

export function decodeNRTR(data: Int32Array, dims: readonly number[], dictionary: readonly string[], options: { readonly bosIndex?: number; readonly eosIndex?: number; readonly padIndex?: number; readonly tokenOffset?: number } = {}): readonly DecodedText[] {
  const [batch, steps] = dims;
  if (!batch || !steps) return [];
  const bos = options.bosIndex ?? 0;
  const eos = options.eosIndex ?? 1;
  const pad = options.padIndex ?? 2;
  const offset = options.tokenOffset ?? 3;
  const results: DecodedText[] = [];
  for (let item = 0; item < batch; item += 1) {
    let text = "";
    for (let step = 0; step < steps; step += 1) {
      const token = data[item * steps + step];
      if (token === eos) break;
      if (token === undefined || token === bos || token === pad) continue;
      text += dictionary[token - offset] ?? "";
    }
    results.push({ text, score: text ? 1 : 0 });
  }
  return results;
}
