// Visual lookup only: the character record remains the source of the clan.
const symbols = new Map<string, string>([
  ["brujah", "brujah"],
  ["gangrel", "gangrel"],
  ["malkavian", "malkavian"],
  ["malkavianer", "malkavian"],
  ["nosferatu", "nosferatu"],
  ["toreador", "toreador"],
  ["tremere", "tremere"],
  ["ventrue", "ventrue"],
  ["ravnos", "ravnos"],
  ["lasombra", "lasombra"],
  ["tzimisce", "tzimisce"],
  ["banu haqim", "banu-haqim"],
  ["salubri", "salubri"],
  ["caitiff", "caitiff"],
  ["thinblood", "thinblood"],
  ["thin-blood", "thinblood"],
  ["the ministry", "the-ministry"],
]);

export function clanSymbolFor(value: string): string | null {
  const symbol = symbols.get(value.trim().toLocaleLowerCase("de-DE"));
  return symbol ? `/graphics/spielerzentrale-v01/clans/${symbol}.png` : null;
}
