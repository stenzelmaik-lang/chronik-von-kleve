"use client";

import { useLayoutEffect, useRef, useState, type ClipboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  encodeRichText,
  parseRichTextDocument,
  readRichText,
  richTextColors,
  richTextToPlainText,
  type RichTextBlock,
  type RichTextDocument,
  type RichTextInline,
} from "@/domain/location-rich-text";
import styles from "./rich-text.module.css";

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

function colorValue(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replaceAll(" ", "");
  const colors: Record<string, string> = {
    "#d6b36f": "#d6b36f", "rgb(214,179,111)": "#d6b36f",
    "#eee6d6": "#eee6d6", "rgb(238,230,214)": "#eee6d6",
    "#a9c3cf": "#a9c3cf", "rgb(169,195,207)": "#a9c3cf",
    "#d38b82": "#d38b82", "rgb(211,139,130)": "#d38b82",
  };
  return colors[normalized] as RichTextInline["color"] | undefined;
}

function childWithMarks(node: Node, inherited: Omit<RichTextInline, "text"> = {}): RichTextInline[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? [{ text: node.textContent, ...inherited }] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  const tag = node.tagName.toLowerCase();
  const marks: Omit<RichTextInline, "text"> = { ...inherited };
  if (["b", "strong"].includes(tag)) marks.bold = true;
  if (["i", "em"].includes(tag)) marks.italic = true;
  if (tag === "u") marks.underline = true;
  if (tag === "a") {
    const href = safeHref(node.getAttribute("href") || "");
    if (href) marks.href = href;
  }
  if (tag === "font") marks.color = colorValue(node.getAttribute("color")) || marks.color;
  marks.color = colorValue(node.style.color) || marks.color;
  return Array.from(node.childNodes).flatMap(child => childWithMarks(child, marks));
}

function documentFromEditor(root: HTMLElement): RichTextDocument {
  const blocks: RichTextBlock[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) blocks.push({ type: "paragraph", children: [{ text: node.textContent }] });
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.children).filter(item => item.tagName.toLowerCase() === "li")
        .map(item => Array.from(item.childNodes).flatMap(child => childWithMarks(child)));
      blocks.push({ type: tag === "ul" ? "bulletList" : "orderedList", items });
    } else {
      const type = tag === "h2" || tag === "h3" ? tag === "h2" ? "heading2" : "heading3" : "paragraph";
      blocks.push({ type, children: Array.from(node.childNodes).flatMap(child => childWithMarks(child)) });
    }
  }
  return parseRichTextDocument({ version: 1, blocks }) || { version: 1, blocks: [{ type: "paragraph", children: [] }] };
}

function appendInline(parent: HTMLElement, inline: RichTextInline) {
  let node: Node = document.createTextNode(inline.text);
  const wrap = (tag: string, child: Node) => { const element = document.createElement(tag); element.appendChild(child); return element; };
  if (inline.bold) node = wrap("strong", node);
  if (inline.italic) node = wrap("em", node);
  if (inline.underline) node = wrap("u", node);
  if (inline.color && richTextColors.includes(inline.color)) {
    const element = document.createElement("span"); element.style.color = inline.color; element.appendChild(node); node = element;
  }
  if (inline.href) {
    const href = safeHref(inline.href);
    if (href) { const element = document.createElement("a"); element.href = href; element.rel = "noopener noreferrer"; element.target = "_blank"; element.appendChild(node); node = element; }
  }
  parent.appendChild(node);
}

function replaceEditorContents(editor: HTMLElement, value: string) {
  const documentModel = readRichText(value);
  const fragment = document.createDocumentFragment();
  for (const block of documentModel.blocks) {
    if (block.type === "bulletList" || block.type === "orderedList") {
      const list = document.createElement(block.type === "bulletList" ? "ul" : "ol");
      for (const item of block.items) { const li = document.createElement("li"); item.forEach(part => appendInline(li, part)); list.appendChild(li); }
      fragment.appendChild(list);
    } else {
      const element = document.createElement(block.type === "heading2" ? "h2" : block.type === "heading3" ? "h3" : "p");
      block.children.forEach(part => appendInline(element, part)); fragment.appendChild(element);
    }
  }
  editor.replaceChildren(fragment);
}

function inlineElements(parts: RichTextInline[], keyPrefix: string) {
  return parts.map((part, index) => {
    let node: ReactNode = part.text;
    if (part.bold) node = <strong>{node}</strong>;
    if (part.italic) node = <em>{node}</em>;
    if (part.underline) node = <u>{node}</u>;
    if (part.color) node = <span style={{ color: part.color }}>{node}</span>;
    if (part.href) { const href = safeHref(part.href); if (href) node = <a href={href} target="_blank" rel="noopener noreferrer">{node}</a>; }
    return <span key={`${keyPrefix}-${index}`}>{node}</span>;
  });
}

export function RichTextView({ value, className }: { value: string; className?: string }) {
  const documentModel = readRichText(value);
  return <div className={className}>
    {documentModel.blocks.map((block, index) => {
      if (block.type === "bulletList" || block.type === "orderedList") {
        const List = block.type === "bulletList" ? "ul" : "ol";
        return <List key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{inlineElements(item, `l${index}-${itemIndex}`)}</li>)}</List>;
      }
      const children = inlineElements(block.children, `b${index}`);
      if (block.type === "heading2") return <h2 key={`block-${index}`}>{children}</h2>;
      if (block.type === "heading3") return <h3 key={`block-${index}`}>{children}</h3>;
      return <p key={`block-${index}`}>{children}</p>;
    })}
  </div>;
}

export function RichTextEditor({
  value,
  onChange,
  label,
  maximumPlainLength,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  maximumPlainLength: number;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [link, setLink] = useState("");
  const [plainLength, setPlainLength] = useState(richTextToPlainText(value).length);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const initialValueRef = useRef(value);
  useLayoutEffect(() => {
    if (editorRef.current) replaceEditorContents(editorRef.current, initialValueRef.current);
  }, []);

  function commit() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = encodeRichText(documentFromEditor(editor));
    const length = richTextToPlainText(next).length;
    setPlainLength(length);
    setLimitExceeded(length > maximumPlainLength);
    if (length <= maximumPlainLength) onChange(next);
  }

  function preserveSelection(event: MouseEvent) {
    event.preventDefault();
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  }

  function command(action: string, argument?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    document.execCommand(action, false, argument);
    savedRange.current = null;
    commit();
  }

  function insertLink() {
    const href = safeHref(link.trim());
    if (!href) return;
    command("createLink", href);
    setLink("");
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    commit();
  }

  return <div className={styles.editor}>
    <div className={styles.toolbar} role="toolbar" aria-label={`${label} formatieren`}>
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("formatBlock", "<h2>")} aria-label="Überschrift groß">H2</button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("formatBlock", "<h3>")} aria-label="Überschrift klein">H3</button>
      <span aria-hidden="true" />
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("bold")} aria-label="Fett formatieren"><strong>B</strong></button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("italic")} aria-label="Kursiv formatieren"><em>I</em></button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("underline")} aria-label="Unterstreichen"><u>U</u></button>
      <span aria-hidden="true" />
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("insertUnorderedList")} aria-label="Aufzählung einfügen">• Liste</button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => command("insertOrderedList")} aria-label="Nummerierte Liste einfügen">1. Liste</button>
      <label className={styles.colorControl}><span>Textfarbe</span><select aria-label="Textfarbe" defaultValue="#d6b36f" onMouseDown={()=>{const selection=window.getSelection();if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange();}} onChange={event => command("foreColor", event.target.value)}>{richTextColors.map(color => <option key={color} value={color}>{color === "#d6b36f" ? "Gold" : color === "#eee6d6" ? "Elfenbein" : color === "#a9c3cf" ? "Nebelblau" : "Rostrot"}</option>)}</select></label>
    </div>
    <div className={styles.linkRow}><label><span>Link zur Auswahl</span><input type="url" value={link} onChange={event => setLink(event.target.value)} onMouseDown={() => { const selection = window.getSelection(); if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange(); }} placeholder="https://…"/></label><button type="button" onMouseDown={preserveSelection} onClick={insertLink}>Link setzen</button></div>
    <div
      ref={editorRef}
      className={styles.editable}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={commit}
      onBlur={commit}
      onPaste={handlePaste}
      onKeyUp={() => { const editor=editorRef.current;if(editor){savedRange.current=window.getSelection()?.rangeCount?window.getSelection()!.getRangeAt(0).cloneRange():null;} }}
      onMouseUp={() => { const editor=editorRef.current;if(editor){savedRange.current=window.getSelection()?.rangeCount?window.getSelection()!.getRangeAt(0).cloneRange():null;} }}
    />
    <div className={styles.editorFooter}><span role={limitExceeded?"alert":undefined}>{limitExceeded?`Text zu lang: kürze auf höchstens ${maximumPlainLength} Zeichen, bevor du weiterarbeitest.`:"Formatierungen bleiben auf Überschriften, Listen, Hervorhebungen, Links und die vier Kampagnenfarben begrenzt."}</span><small data-over-limit={limitExceeded}>{plainLength}/{maximumPlainLength}</small></div>
  </div>;
}

export { richTextToPlainText };
