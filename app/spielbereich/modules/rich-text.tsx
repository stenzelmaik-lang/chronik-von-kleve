/* eslint-disable @next/next/no-img-element -- Images use the protected authenticated file API. */
"use client";

import { useLayoutEffect, useRef, useState, type ClipboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  encodeRichText,
  htmlToRichText, richTextToHtml,
  readRichText,
  richTextColors,
  richTextToPlainText,
  type RichTextDocument,
  type RichTextInline,
} from "@/domain/location-rich-text";
import styles from "./rich-text.module.css";

function safeHref(value: string) {
  if (/^\/(?:sl\/command-center|spielbereich)(?:\?|$)/.test(value) && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

function documentFromEditor(root:HTMLElement):RichTextDocument { return readRichText(htmlToRichText(root.innerHTML)); }
function replaceEditorContents(editor:HTMLElement,value:string) { editor.innerHTML=richTextToHtml(value); }

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
      if(block.type==='divider')return <hr key={index}/>;
      if(block.type==='image')return <img key={index} src={'/api/files?id='+encodeURIComponent(block.fileId)} alt={block.alt} style={{maxWidth:'100%',height:'auto'}}/>;
      if(block.type==='table')return <div key={index} style={{overflowX:'auto'}}><table><tbody>{block.rows.map((r,ri)=><tr key={ri}>{r.map((c,ci)=><td key={ci}>{inlineElements(c,`t${index}-${ri}-${ci}`)}</td>)}</tr>)}</tbody></table></div>;
      if(block.type==='quote')return <blockquote key={index}>{inlineElements(block.children,`q${index}`)}</blockquote>;
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
  advanced = false,
  files = [],
  compactTools = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  maximumPlainLength: number;
  placeholder: string;
  advanced?:boolean;
  files?:{id:string;name:string;mime:string;visibility?:string}[];
  compactTools?: boolean;
}) {
  const [htmlMode,setHtmlMode]=useState(false),[htmlDraft,setHtmlDraft]=useState(''),[htmlError,setHtmlError]=useState(''),[imageId,setImageId]=useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [link, setLink] = useState("");
  const [extraTools,setExtraTools]=useState(!compactTools),[linkOpen,setLinkOpen]=useState(!compactTools),[imageOpen,setImageOpen]=useState(!compactTools),[imageSearch,setImageSearch]=useState('');
  const [plainLength, setPlainLength] = useState(richTextToPlainText(value).length);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const initialValueRef = useRef(value);
  const canonicalValueRef=useRef(htmlToRichText(richTextToHtml(value)));
  useLayoutEffect(()=>{initialValueRef.current=value;canonicalValueRef.current=htmlToRichText(richTextToHtml(value));},[value]);
  useLayoutEffect(() => {
    if (editorRef.current) replaceEditorContents(editorRef.current, initialValueRef.current);
  }, [htmlMode]);

  function commit() {
    const editor = editorRef.current;
    if (!editor) return;
    let next:string;try{next=encodeRichText(documentFromEditor(editor));}catch(e){setHtmlError((e as Error).message);return;}
    const length = richTextToPlainText(next).length;
    setPlainLength(length);
    setLimitExceeded(length > maximumPlainLength);
    if (length <= maximumPlainLength && next!==canonicalValueRef.current) onChange(next);
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

  function sourceChange(raw:string){setHtmlDraft(raw);try{const next=htmlToRichText(raw);if(richTextToPlainText(next).length>maximumPlainLength)throw new Error('Text zu lang.');setHtmlError('');onChange(next);}catch(e){setHtmlError((e as Error).message);}}
  return <div className={styles.editor}>
    {compactTools&&<div className={styles.toolbar}><button type="button" aria-expanded={linkOpen} onMouseDown={preserveSelection} onClick={()=>setLinkOpen(!linkOpen)}>Link</button>{advanced&&<button type="button" aria-expanded={imageOpen} onMouseDown={preserveSelection} onClick={()=>setImageOpen(!imageOpen)}>Bild</button>}<button type="button" aria-expanded={extraTools} onClick={()=>setExtraTools(!extraTools)}>Weitere Formatierung</button></div>}
    {advanced&&extraTools&&<div className={styles.toolbar}><button type="button" aria-pressed={!htmlMode} onClick={()=>{setHtmlMode(false);if(editorRef.current)replaceEditorContents(editorRef.current,value);}}>Visuell</button><button type="button" aria-pressed={htmlMode} onClick={()=>{setHtmlDraft(richTextToHtml(value));setHtmlMode(true);}}>HTML · Expertenansicht</button><small>Nur sichere Struktur; Bilder aus dem geschützten Dateispeicher.</small></div>}
    {htmlMode?<textarea aria-label={label+' HTML'} value={htmlDraft} onChange={e=>sourceChange(e.target.value)} rows={16}/>:<>
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
      {advanced&&extraTools&&<><button type="button" onMouseDown={preserveSelection} onClick={()=>command('formatBlock','<blockquote>')}>Zitat</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHorizontalRule')}>Trennlinie</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHTML','<table><tbody><tr><td>Spalte 1</td><td>Spalte 2</td></tr><tr><td>Inhalt</td><td>Inhalt</td></tr></tbody></table><p><br></p>')}>Tabelle</button></>}
      <label className={styles.colorControl}><span>Textfarbe</span><select aria-label="Textfarbe" defaultValue="#d6b36f" onMouseDown={()=>{const selection=window.getSelection();if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange();}} onChange={event => command("foreColor", event.target.value)}>{richTextColors.map(color => <option key={color} value={color}>{color === "#d6b36f" ? "Gold" : color === "#eee6d6" ? "Elfenbein" : color === "#a9c3cf" ? "Nebelblau" : "Rostrot"}</option>)}</select></label>
    </div>
    {linkOpen&&<div className={styles.linkRow}><label><span>Link zur Auswahl</span><input type="text" value={link} onChange={event => setLink(event.target.value)} onMouseDown={() => { const selection = window.getSelection(); if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange(); }} placeholder={advanced?"https://… oder /sl/command-center?story=…":"https://…"}/></label><button type="button" onMouseDown={preserveSelection} onClick={insertLink}>Link setzen</button></div>}
    {advanced&&imageOpen&&<div className={styles.linkRow}><label>Geschütztes Bild<input aria-label={label+' Bilder suchen'} placeholder="Dateiname oder ID …" value={imageSearch} onChange={e=>setImageSearch(e.target.value)}/><select aria-label={label+' Bild'} value={imageId} onChange={e=>setImageId(e.target.value)}><option value="">Vorhandenes Bild auswählen</option>{files.filter(f=>f.mime.startsWith('image/')&&(f.name+' '+f.id).toLowerCase().includes(imageSearch.toLowerCase())).map(f=><option key={f.id} value={f.id}>{f.name} · {f.id}{f.visibility ? ` · Dateiregel: ${f.visibility==='group'?'Gruppe':f.visibility==='sl'?'SL':'Eigentümer'}` : ''}</option>)}</select></label><button type="button" disabled={!imageId} onMouseDown={preserveSelection} onClick={()=>{command('insertHTML','<img src="/api/files?id='+imageId.replace(/[^a-zA-Z0-9_.-]/g,'')+'" alt="SL-Unterlage"><p><br></p>');setImageId('');}}>Bild einfügen</button></div>}
    {advanced&&imageOpen&&imageId&&<figure><img src={'/api/files?id='+encodeURIComponent(imageId)} alt="Vorschau des ausgewählten geschützten Bildes" style={{maxWidth:180,maxHeight:140,objectFit:'contain'}}/><figcaption>Geschützter Dateispeicher · Dateiregel: {files.find(file=>file.id===imageId)?.visibility==='group'?'Gruppe':files.find(file=>file.id===imageId)?.visibility==='sl'?'SL':files.find(file=>file.id===imageId)?.visibility==='private'?'Eigentümer':'nicht angegeben'}. Auswahl veröffentlicht nichts; der Server prüft den tatsächlichen Zugriff.</figcaption></figure>}
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
    </>}{htmlError&&<p role="alert">{htmlError}</p>}
    <div className={styles.editorFooter}><span role={limitExceeded?"alert":undefined}>{limitExceeded?`Text zu lang: kürze auf höchstens ${maximumPlainLength} Zeichen, bevor du weiterarbeitest.`:advanced?"HTML wird als sichere Dokumentstruktur gespeichert; Scripts und externe Einbettungen entfallen.":"Überschriften, Listen, Hervorhebungen, Links und Kampagnenfarben."}</span><small data-over-limit={limitExceeded}>{plainLength}/{maximumPlainLength}</small></div>
  </div>;
}

export { richTextToPlainText };
