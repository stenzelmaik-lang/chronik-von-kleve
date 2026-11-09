import { readRichText } from "@/domain/location-rich-text";

/** Calm teaser from a stored text (rich or plain): running text only, no headings, colours or dividers. */
export function richTeaser(value: unknown, max = 260) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parts = readRichText(value).blocks.flatMap(b =>
    b.type === "paragraph" || b.type === "quote" ? [b.children.map(c => c.text).join("")]
    : b.type === "bulletList" || b.type === "orderedList" ? b.items.map(i => i.map(c => c.text).join(""))
    : []);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, "") + " …" : text;
}
