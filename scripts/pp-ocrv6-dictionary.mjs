function parseYamlScalar(value) {
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

export function extractCharacterDictionary(yaml, options = {}) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^  character_dict:\s*$/.test(line));
  if (start < 0) return [];
  const characters = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^  [A-Za-z_][\w-]*:/.test(line)) break;
    const match = /^  - (.*)$/.exec(line);
    if (match) characters.push(parseYamlScalar(match[1]));
  }
  const dictionary = characters.filter((character) => character.length > 0);
  return options.useSpaceChar ? [...dictionary, " "] : dictionary;
}
