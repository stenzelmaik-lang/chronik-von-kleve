export const richTextPrefix = "cvk-rich-v1:";

export const richTextColors = ["#d6b36f", "#eee6d6", "#a9c3cf", "#d38b82"] as const;
export type RichTextColor = (typeof richTextColors)[number];

export type RichTextInline = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  color?: RichTextColor;
  href?: string;
};

export type RichTextBlock =
  | { type: "paragraph"; children: RichTextInline[] }
  | { type: "heading2"; children: RichTextInline[] }
  | { type: "heading3"; children: RichTextInline[] }
  | { type: "bulletList"; items: RichTextInline[][] }
  | { type: "orderedList"; items: RichTextInline[][] };

export type RichTextDocument = { version: 1; blocks: RichTextBlock[] };

const safeHref = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 1000) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

function parseInline(value: unknown): RichTextInline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["text", "bold", "italic", "underline", "color", "href"].includes(key))) return null;
  if (typeof row.text !== "string" || row.text.length > 5000) return null;
  if (row.bold !== undefined && row.bold !== true || row.italic !== undefined && row.italic !== true || row.underline !== undefined && row.underline !== true) return null;
  if (row.color !== undefined && !richTextColors.includes(row.color as RichTextColor)) return null;
  const href = row.href === undefined ? undefined : safeHref(row.href);
  if (row.href !== undefined && !href) return null;
  return {
    text: row.text,
    ...(row.bold ? { bold: true as const } : {}),
    ...(row.italic ? { italic: true as const } : {}),
    ...(row.underline ? { underline: true as const } : {}),
    ...(row.color ? { color: row.color as RichTextColor } : {}),
    ...(href ? { href } : {}),
  };
}

export function parseRichTextDocument(value: unknown): RichTextDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => key !== "version" && key !== "blocks")) return null;
  if (row.version !== 1 || !Array.isArray(row.blocks) || row.blocks.length > 120) return null;
  const blocks: RichTextBlock[] = [];
  let inlineCount = 0;
  for (const candidate of row.blocks) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const block = candidate as Record<string, unknown>;
    if (["paragraph", "heading2", "heading3"].includes(String(block.type))) {
      if (Object.keys(block).some(key => key !== "type" && key !== "children")) return null;
      if (!Array.isArray(block.children) || block.children.length > 120) return null;
      const children = block.children.map(parseInline);
      if (children.some(item => item === null)) return null;
      inlineCount += children.length;
      blocks.push({ type: block.type as "paragraph" | "heading2" | "heading3", children: children as RichTextInline[] });
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      if (Object.keys(block).some(key => key !== "type" && key !== "items")) return null;
      if (!Array.isArray(block.items) || block.items.length > 120) return null;
      const items: RichTextInline[][] = [];
      for (const rawItem of block.items) {
        if (!Array.isArray(rawItem) || rawItem.length > 120) return null;
        const parsed = rawItem.map(parseInline);
        if (parsed.some(item => item === null)) return null;
        inlineCount += parsed.length;
        items.push(parsed as RichTextInline[]);
      }
      blocks.push({ type: block.type, items });
    } else return null;
    if (inlineCount > 800) return null;
  }
  return { version: 1, blocks };
}

export function legacyRichTextDocument(value: string): RichTextDocument {
  const lines = value.split(/\r?\n/);
  return { version: 1, blocks: (lines.length ? lines : [""]).map(line => ({ type: "paragraph" as const, children: [{ text: line }] })) };
}

export function readRichText(value: string): RichTextDocument {
  if (value.startsWith(richTextPrefix)) {
    try {
      const parsed = parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)));
      if (parsed) return parsed;
    } catch { /* Invalid rich-text is rendered as harmless literal text. */ }
  }
  return legacyRichTextDocument(value);
}

export function encodeRichText(document: RichTextDocument): string {
  const parsed = parseRichTextDocument(document);
  return parsed ? richTextPrefix + JSON.stringify(parsed) : "";
}

export function richTextToPlainText(value: string): string {
  return readRichText(value).blocks.map(block => block.type === "bulletList" || block.type === "orderedList"
    ? block.items.map(item => item.map(part => part.text).join("")).join("\n")
    : block.children.map(part => part.text).join("")).join("\n");
}

export function isRichTextWithinLimit(value: string, maximumPlainLength: number): boolean {
  if (!value.startsWith(richTextPrefix)) return value.trim().length <= maximumPlainLength;
  if (value.length > maximumPlainLength * 6 + 512) return false;
  try {
    const document = parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)));
    return Boolean(document && richTextToPlainText(encodeRichText(document)).trim().length <= maximumPlainLength);
  } catch {
    return false;
  }
}
