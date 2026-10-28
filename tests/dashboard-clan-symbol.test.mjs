import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clanSymbolFor } from "../app/spielbereich/modules/clan-symbol.ts";

test("clan emblems follow the actual character clan and have local image files", async () => {
  const clans = ["Brujah", "Gangrel", "Malkavianer", "Nosferatu", "Toreador", "Tremere", "Ventrue", "Ravnos", "Lasombra", "Tzimisce", "Banu Haqim", "Salubri", "Caitiff", "Thinblood", "The Ministry"];
  const symbols = clans.map(clanSymbolFor);
  assert.equal(new Set(symbols).size, clans.length);
  for (const symbol of symbols) {
    assert.ok(symbol);
    const image = await readFile(new URL(`../public${symbol}`, import.meta.url));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
  assert.equal(clanSymbolFor("  TOREADOR  "), clanSymbolFor("Toreador"));
  assert.equal(clanSymbolFor("Malkavian"), clanSymbolFor("Malkavianer"));
  assert.equal(clanSymbolFor("Unbekannt"), null);
  assert.equal(clanSymbolFor(""), null);
});
