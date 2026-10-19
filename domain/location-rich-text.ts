import { parseFragment } from 'parse5';
export const richTextPrefix = "cvk-rich-v1:";

export const richTextColors = ["#d6b36f", "#eee6d6", "#a9c3cf", "#d38b82"] as const;
export type RichTextColor = (typeof richTextColors)[number];

export const richTextClasses = ["cp-intro", "cp-highlight", "cp-note", "cp-divider"] as const;

function allowedClasses(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 200) return undefined;
  const classes = [...new Set(value.split(/\s+/).filter(name => richTextClasses.includes(name as typeof richTextClasses[number])))];
  return classes.length ? classes.join(" ") : undefined;
}

export type RichTextInline = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  color?: RichTextColor;
  href?: string;
  className?: string;
};

export type RichTextBlock = (
  | { type: "paragraph"; children: RichTextInline[] }
  | { type: "heading2"; children: RichTextInline[] }
  | { type: "heading3"; children: RichTextInline[] }
  | { type: "bulletList"; items: RichTextInline[][] }
  | { type: "orderedList"; items: RichTextInline[][] }
  | { type: "quote"; children: RichTextInline[] }
  | { type: "table"; rows: RichTextInline[][][] }
  | { type: "image"; fileId: string; alt: string }
  | { type: "divider" }
) & { className?: string };

export type RichTextDocument = { version: 1; blocks: RichTextBlock[] };

const safeHref = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 1000) return undefined;
  if (/^\/(?:sl\/command-center|spielbereich)(?:\?|$)/.test(value) && !value.includes("\\")) return value;
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
  if (Object.keys(row).some(key => !["text", "bold", "italic", "underline", "color", "href", "className"].includes(key))) return null;
  if (typeof row.text !== "string" || row.text.length > 10000) return null;
  if (row.bold !== undefined && row.bold !== true || row.italic !== undefined && row.italic !== true || row.underline !== undefined && row.underline !== true) return null;
  if (row.color !== undefined && !richTextColors.includes(row.color as RichTextColor)) return null;
  const href = row.href === undefined ? undefined : safeHref(row.href);
  if (row.href !== undefined && !href) return null;
  const className = allowedClasses(row.className);
  if (row.className !== undefined && (!className || className !== row.className)) return null;
  return {
    text: row.text,
    ...(row.bold ? { bold: true as const } : {}),
    ...(row.italic ? { italic: true as const } : {}),
    ...(row.underline ? { underline: true as const } : {}),
    ...(row.color ? { color: row.color as RichTextColor } : {}),
    ...(href ? { href } : {}),
    ...(className ? { className } : {}),
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
    const { className: rawClassName, ...block } = candidate as Record<string, unknown>;
    const className = allowedClasses(rawClassName);
    if (rawClassName !== undefined && (!className || className !== rawClassName)) return null;
    if (["paragraph", "heading2", "heading3", "quote"].includes(String(block.type))) {
      if (Object.keys(block).some(key => key !== "type" && key !== "children")) return null;
      if (!Array.isArray(block.children) || block.children.length > 120) return null;
      const children = block.children.map(parseInline);
      if (children.some(item => item === null)) return null;
      inlineCount += children.length;
      blocks.push({ type: block.type as "paragraph" | "heading2" | "heading3" | "quote", children: children as RichTextInline[] });
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
    } else if (block.type === "divider" && Object.keys(block).length === 1) {
      blocks.push({ type: "divider" });
    } else if (block.type === "image") {
      if (Object.keys(block).some(k => !['type','fileId','alt'].includes(k)) || typeof block.fileId !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(block.fileId) || typeof block.alt !== 'string' || block.alt.length > 300) return null;
      blocks.push({type:'image', fileId:block.fileId, alt:block.alt});
    } else if (block.type === 'table') {
      if(Object.keys(block).some(k=>!['type','rows'].includes(k)) || !Array.isArray(block.rows) || block.rows.length>30) return null;
      const rows: RichTextInline[][][]=[];
      for(const raw of block.rows) {
        if(!Array.isArray(raw)||raw.length>10)return null;
        const cells: RichTextInline[][]=[];
        for(const cell of raw) {
          if(!Array.isArray(cell)||cell.length>120)return null;
          const parts=cell.map(parseInline);if(parts.some(p=>p===null))return null;
          inlineCount+=parts.length;cells.push(parts as RichTextInline[]);
        }
        rows.push(cells);
      }
      blocks.push({type:'table',rows});
    } else return null;
    if (className) blocks[blocks.length - 1].className = className;
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

// Read-only presentation of indented HTML, never a storage/editor conversion.
// v1 does not record the origin of every newline: ambiguous unindented breaks
// are retained rather than silently erased, including after HTML roundtrips.
export function proseInlineParts(parts: RichTextInline[]): RichTextInline[] {
  const indented = /\r?\n[\t ]+/.test(parts.map(part => part.text).join(""));
  return parts.flatMap((part, index) => {
    let text = part.text;
    if (indented && !/^(?:\r?\n)+$/.test(text)) {
      text = text.replace(/\r?\n[\t ]+/g, " ");
      if (index === 0) text = text.replace(/^[\t\r\n\f ]+/, "");
      if (index === parts.length - 1) text = text.replace(/[\t\r\n\f ]+$/, "");
    }
    return text.split(/\r?\n/).flatMap((line, lineIndex) => [
      ...(lineIndex ? [{ ...part, text: "\n" }] : []),
      ...(line ? [{ ...part, text: line }] : []),
    ]);
  });
}

// Presentation only: the stored document is never rewritten or truncated.
export function splitRichTextIntroduction(value: string): { introduction: string | null; description: string } {
  const document = readRichText(value);
  const isIntro = (block: RichTextBlock) => {
    if (block.className?.split(" ").includes("cp-intro")) return true;
    // Also support an introduction wrapped in an existing allowed <span>.
    if (block.type !== "paragraph") return false;
    const content = block.children.filter(part => part.text.trim());
    return content.length > 0 && content.every(part => part.className?.split(" ").includes("cp-intro"));
  };
  const start = document.blocks.findIndex(isIntro);
  if (start < 0) return { introduction: null, description: value };
  let end = start + 1;
  while (end < document.blocks.length && isIntro(document.blocks[end])) end++;
  const remaining = [...document.blocks.slice(0, start), ...document.blocks.slice(end)];
  return {
    introduction: encodeRichText({ version: 1, blocks: document.blocks.slice(start, end) }),
    description: remaining.length ? encodeRichText({ version: 1, blocks: remaining }) : "",
  };
}

export function richTextToPlainText(value: string): string {
  return readRichText(value).blocks.map(block => {
    if(block.type==='divider')return '';
    if(block.type==='image')return block.alt;
    if(block.type==='table')return block.rows.map(row=>row.map(c=>c.map(p=>p.text).join('')).join(' | ')).join('\n');
    return block.type === 'bulletList' || block.type === 'orderedList' ? block.items.map(item=>item.map(p=>p.text).join('')).join('\n') : block.children.map(p=>p.text).join('');
  }).join('\n');
}

export function isRichTextWithinLimit(value: string, maximumPlainLength: number): boolean {
  if (!value.startsWith(richTextPrefix)) return value.trim().length <= maximumPlainLength;
  // Bound structural overhead independently: formatting is not visible text.
  if (value.length > Math.max(65000, maximumPlainLength * 6 + 512)) return false;
  try {
    const document = parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)));
    return Boolean(document && richTextToPlainText(encodeRichText(document)).trim().length <= maximumPlainLength);
  } catch {
    return false;
  }
}

// HTML is parsed into the existing typed document. Raw markup is never rendered or stored.
export const richHtmlPrefix='cvk-html-v1:';
type HtmlNode={nodeName:string;tagName?:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:HtmlNode[]};
const forbidden=new Set(['script','style','iframe','object','embed','svg','math','template','noscript','form','input','button','video','audio']);
export function htmlToRichText(html:string):string {
  if(html.length>65000)throw new Error('HTML zu lang.');
  const root=parseFragment(html) as unknown as HtmlNode;
  let visited=0;
  const inline=(n:HtmlNode,marks:Omit<RichTextInline,'text'>={},depth=0):RichTextInline[]=>{
    if(++visited>5000||depth>40)throw new Error('HTML zu komplex.');
    if(n.nodeName==='#text')return [{text:n.value||'',...marks}];
    const tag=n.tagName||'';if(forbidden.has(tag))return [];
    const m={...marks};if(['b','strong'].includes(tag))m.bold=true;if(['i','em'].includes(tag))m.italic=true;if(tag==='u')m.underline=true;
    if(tag==='span'){
      const className=allowedClasses([marks.className,n.attrs?.find(a=>a.name==='class')?.value].filter(Boolean).join(' '));
      if(className)m.className=className;
    }
    const color=n.attrs?.find(a=>a.name==='style')?.value.match(/(?:^|;)\s*color\s*:\s*(#[a-f0-9]{6}|rgb\([^)]*\))/i)?.[1]?.toLowerCase()||n.attrs?.find(a=>a.name==='color')?.value.toLowerCase();const rgb=color?.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);const normalized=rgb?'#'+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):color;if(normalized&&richTextColors.includes(normalized as RichTextColor))m.color=normalized as RichTextColor;
    if(tag==='a'){const href=safeHref(n.attrs?.find(a=>a.name==='href')?.value);if(href)m.href=href;}
    if(tag==='br')return [{text:'\n',...m}];
    const children:RichTextInline[]=[];
    const lineBlocks=new Set(['p','div','h1','h2','h3','h4','ul','ol','li','blockquote']);
    let previousWasBlock=false;
    for(const child of n.childNodes||[]){
      const parts=inline(child,m,depth+1), isBlock=lineBlocks.has(child.tagName||'');
      if(parts.length&&children.length&&(isBlock||previousWasBlock)&&!children.at(-1)!.text.endsWith('\n'))children.push({text:'\n',...m});
      children.push(...parts);
      if(parts.length)previousWasBlock=isBlock;
    }
    return children;
  };
  const blocks:RichTextBlock[]=[];
  const walk=(n:HtmlNode,depth=0)=>{
    if(depth>40||++visited>5000)throw new Error('HTML zu komplex.');
    const tag=n.tagName||'';if(forbidden.has(tag))return;
    const className=allowedClasses(n.attrs?.find(a=>a.name==='class')?.value);
    const decoration=className?{className}:{};
    if(tag==='hr'){blocks.push({type:'divider',...decoration});return;}
    if(tag==='img'){
      const src=n.attrs?.find(a=>a.name==='src')?.value||'';const match=src.match(/^\/api\/files\?id=([a-zA-Z0-9_.-]{1,100})$/);
      if(match)blocks.push({type:'image',fileId:match[1],alt:(n.attrs?.find(a=>a.name==='alt')?.value||'Ortsunabhängiges SL-Bild').slice(0,300)});return;
    }
    if(tag==='table'){
      const rows:RichTextInline[][][]=[];
      const tr=(node:HtmlNode,d=0)=>{if(d>40)throw new Error('Tabelle zu komplex.');if(node.tagName==='tr')rows.push((node.childNodes||[]).filter(c=>['td','th'].includes(c.tagName||'')).map(c=>inline(c)));else(node.childNodes||[]).forEach(c=>{if(++visited>5000)throw new Error('Tabelle zu komplex.');tr(c,d+1);});};tr(n);
      blocks.push({type:'table',rows,...decoration});return;
    }
    if(tag==='ul'||tag==='ol'){blocks.push({type:tag==='ul'?'bulletList':'orderedList',items:(n.childNodes||[]).filter(c=>c.tagName==='li').map(c=>inline(c)),...decoration});return;}
    if(['p','h1','h2','h3','h4','blockquote'].includes(tag)){
      blocks.push({type:tag==='blockquote'?'quote':['h1','h2'].includes(tag)?'heading2':['h3','h4'].includes(tag)?'heading3':'paragraph',children:(n.childNodes?.length===1&&n.childNodes[0].tagName==='br')?[]:inline(n),...decoration});
      (n.childNodes||[]).filter(c=>c.tagName==='img'||c.tagName==='hr').forEach(c=>walk(c,depth+1));return;
    }
    if(['span','a','b','strong','i','em','u','font'].includes(tag)){blocks.push({type:'paragraph',children:(n.childNodes?.length===1&&n.childNodes[0].tagName==='br')?[]:inline(n)});return;}
    if(n.nodeName==='#text'){if(n.value?.trim())blocks.push({type:'paragraph',children:[{text:n.value}]});return;}
    (n.childNodes||[]).forEach(c=>walk(c,depth+1));
  };
  (root.childNodes||[]).forEach(n=>walk(n));
  const parsed=parseRichTextDocument({version:1,blocks});if(!parsed)throw new Error('HTML überschreitet die zulässige Dokumentstruktur.');return encodeRichText(parsed);
}
export function sanitizeRichTextInput(value:string):string { return value.startsWith(richHtmlPrefix)?htmlToRichText(value.slice(richHtmlPrefix.length)):value; }

export function inspectRichTextSource(html:string, maximumPlainLength:number):{value?:string;plainLength:number|null;error:string} {
  try {
    const value=htmlToRichText(html),plainLength=richTextToPlainText(value).length;
    return {value,plainLength,error:isRichTextWithinLimit(value,maximumPlainLength)?'':`Bitte kürze den sichtbaren Text auf ${maximumPlainLength} Zeichen oder vereinfache die Formatierung.`};
  } catch(error) {
    return {plainLength:null,error:error instanceof Error?error.message:'HTML konnte nicht geprüft werden.'};
  }
}

const escapeHtml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function richTextToHtml(value:string):string {
  const classes=(value:unknown)=>{const safe=allowedClasses(value);return safe?' class="'+safe+'"':'';};
  // Keep separately recorded hard breaks separate on export/reimport, even
  // when the following text starts with spaces. Other source whitespace stays literal.
  const parts=(v:RichTextInline[])=>v.map(p=>{let t=/^(?:\r?\n)+$/.test(p.text)?p.text.replace(/\r?\n/g,'<br>'):escapeHtml(p.text);if(p.bold)t='<strong>'+t+'</strong>';if(p.italic)t='<em>'+t+'</em>';if(p.underline)t='<u>'+t+'</u>';if(p.color)t='<span style="color:'+p.color+'">'+t+'</span>';if(p.className)t='<span'+classes(p.className)+'>'+t+'</span>';if(p.href)t='<a href="'+escapeHtml(p.href)+'">'+t+'</a>';return t;}).join('');
  return readRichText(value).blocks.map(b=>{
    const decoration=classes(b.className);
    if(b.type==='divider')return '<hr'+decoration+'>';
    if(b.type==='image')return '<img src="/api/files?id='+escapeHtml(b.fileId)+'" alt="'+escapeHtml(b.alt)+'">';
    if(b.type==='table')return '<table'+decoration+'><tbody>'+b.rows.map(r=>'<tr>'+r.map(c=>'<td>'+parts(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    if(b.type==='bulletList'||b.type==='orderedList'){const tag=b.type==='bulletList'?'ul':'ol';return '<'+tag+decoration+'>'+b.items.map(i=>'<li>'+parts(i)+'</li>').join('')+'</'+tag+'>';}
    const tag=b.type==='heading2'?'h2':b.type==='heading3'?'h3':b.type==='quote'?'blockquote':'p';return '<'+tag+decoration+'>'+parts(b.children)+'</'+tag+'>';
  }).join('\n');
}
export function richTextFileIds(value:string):string[] { return readRichText(value).blocks.flatMap(b=>b.type==='image'?[b.fileId]:[]); }
