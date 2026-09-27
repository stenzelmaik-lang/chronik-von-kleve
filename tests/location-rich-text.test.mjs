import test from "node:test";
import assert from "node:assert/strict";
import { encodeRichText, isRichTextWithinLimit, parseRichTextDocument, readRichText, richTextToPlainText } from "../domain/location-rich-text.ts";

test("legacy plain location text remains readable and valid", () => {
  const value = "Erster Eindruck\nZweiter Absatz";
  assert.equal(isRichTextWithinLimit(value, 40), true);
  assert.equal(richTextToPlainText(value), value);
  assert.deepEqual(readRichText(value).blocks.map(block => block.type), ["paragraph", "paragraph"]);
});

test("safe rich document preserves headings, inline marks, links, color, and lists", () => {
  const value = encodeRichText({ version: 1, blocks: [
    { type: "heading2", children: [{ text: "Der Raum", bold: true }] },
    { type: "paragraph", children: [{ text: "Licht", italic: true, color: "#d6b36f" }, { text: " · Quelle", href: "https://example.test/source", underline: true }] },
    { type: "bulletList", items: [[{ text: "Erster Hinweis" }], [{ text: "Zweiter Hinweis", bold: true }]] },
  ] });
  assert.ok(value.startsWith("cvk-rich-v1:"));
  assert.equal(isRichTextWithinLimit(value, 100), true);
  assert.equal(richTextToPlainText(value), "Der Raum\nLicht · Quelle\nErster Hinweis\nZweiter Hinweis");
  assert.equal(parseRichTextDocument(JSON.parse(value.slice("cvk-rich-v1:".length)))?.blocks.length, 3);
});

test("rich text rejects executable links, unknown markup properties, and over-limit content", () => {
  assert.equal(parseRichTextDocument({ version: 1, blocks: [{ type: "paragraph", children: [{ text: "x", href: "javascript:alert(1)" }] }] }), null);
  assert.equal(parseRichTextDocument({ version: 1, blocks: [{ type: "paragraph", children: [{ text: "x", onClick: "alert(1)" }] }] }), null);
  const oversized = encodeRichText({ version: 1, blocks: [{ type: "paragraph", children: [{ text: "x".repeat(30) }] }] });
  assert.equal(isRichTextWithinLimit(oversized, 20), false);
  assert.equal(isRichTextWithinLimit("cvk-rich-v1:{broken", 100), false);
});
