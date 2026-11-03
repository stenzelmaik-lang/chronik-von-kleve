/* eslint-disable @next/next/no-img-element -- Images use the protected authenticated file API. */
"use client";

import { useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  encodeRichText,
  htmlToRichText, htmlTextToRichText, inspectRichTextSource, richHtmlPrefix, richTextToHtml,
  readRichText,
  parseRichTextDocument,
  proseInlineParts,
  richTextColors,
  richTextPrefix,
  richTextToPlainText,
  type RichTextDocument,
  type RichTextInline,
} from "@/domain/location-rich-text";
import { ProtectedImageGallery } from "./protected-image-gallery";
import styles from "./rich-text.module.css";

function safeHref(value: string) {
  if (/^\/(?:sl\/command-center|spielbereich)(?:\?|$)/.test(value) && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

function documentFromEditor(root:HTMLElement):RichTextDocument { return readRichText(htmlToRichText(root.innerHTML)); }
function replaceEditorContents(editor:HTMLElement,value:string,flowing=false) { editor.innerHTML=richTextToHtml(value,flowing); }
function canonicalRichText(value:string) { try { return htmlToRichText(value.startsWith(richHtmlPrefix)?value.slice(richHtmlPrefix.length):richTextToHtml(value)); } catch { return value; } }

function inlineElements(parts: RichTextInline[], keyPrefix: string, flowing = false) {
  return (flowing ? proseInlineParts(parts) : parts).map((part, index) => {
    // The existing importer records explicit <br> and nested block boundaries as
    // standalone newline parts. Keep those while HTML source indentation flows.
    let node: ReactNode = flowing && /^(?:\r?\n)+$/.test(part.text)
      ? part.text.split(/\r?\n/).slice(1).map((_, line) => <br key={line}/>)
      : part.text;
    if (part.bold) node = <strong>{node}</strong>;
    if (part.italic) node = <em>{node}</em>;
    if (part.underline) node = <u>{node}</u>;
    if (part.color) node = <span style={{ color: part.color }}>{node}</span>;
    if (part.className) node = <span className={part.className}>{node}</span>;
    if (part.href) { const href = safeHref(part.href); if (href) node = <a href={href} target="_blank" rel="noopener noreferrer">{node}</a>; }
    return <span key={`${keyPrefix}-${index}`}>{node}</span>;
  });
}

export function RichTextView({ value, className, readable = false, flowing = false, fileUrl }: { value: string; fileUrl?:(id:string)=>string; className?: string; readable?: boolean; flowing?: boolean }) {
  const documentModel = readRichText(value);
  let proseFlow = false;
  if (flowing && value.startsWith(richTextPrefix)) {
    try { proseFlow = Boolean(parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)))); }
    catch { /* Malformed historical documents keep their literal fallback. */ }
  }
  return <div data-rich-flow={proseFlow ? "prose" : undefined} className={[styles.content, readable ? styles.view : "", className].filter(Boolean).join(" ")}>
    {documentModel.blocks.map((block, index) => {
      if(block.type==='details')return <details key={index} className={block.className}><summary>{block.summary}</summary><RichTextView value={encodeRichText(block.content)} readable={readable} flowing={flowing} fileUrl={fileUrl}/></details>;
      if(block.type==='divider')return <hr key={index} className={block.className}/>;
      if(block.type==='image')return <img key={index} src={fileUrl?fileUrl(block.fileId):'/api/files?id='+encodeURIComponent(block.fileId)} alt={block.alt} style={{maxWidth:'100%',height:'auto'}}/>;
      if(block.type==='table')return <div key={index} style={{overflowX:'auto'}}><table className={block.className}><tbody>{block.rows.map((r,ri)=><tr key={ri}>{r.map((c,ci)=>block.header&&ri===0?<th key={ci} scope="col">{inlineElements(c,`t${index}-${ri}-${ci}`,proseFlow)}</th>:<td key={ci}>{inlineElements(c,`t${index}-${ri}-${ci}`,proseFlow)}</td>)}</tr>)}</tbody></table></div>;
      if(block.type==='quote')return <blockquote key={index} className={block.className}>{inlineElements(block.children,`q${index}`,proseFlow)}</blockquote>;
      if (block.type === "bulletList" || block.type === "orderedList") {
        const List = block.type === "bulletList" ? "ul" : "ol";
        return <List key={`list-${index}`} className={block.className}>{block.items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{inlineElements(item, `l${index}-${itemIndex}`,proseFlow)}</li>)}</List>;
      }
      const children = inlineElements(block.children, `b${index}`,proseFlow);
      if (block.type === "heading2") return <h2 key={`block-${index}`} className={block.className}>{children}</h2>;
      if (block.type === "heading3") return <h3 key={`block-${index}`} className={block.className}>{children}</h3>;
      return <p key={`block-${index}`} className={block.className}>{children}</p>;
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
  htmlSource = false,
  files = [],
  compactTools = false,
  preparationTools = false,
  inlineGallery = true,
  proseClassName,
  previewValue,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  maximumPlainLength: number;
  placeholder: string;
  advanced?:boolean;
  htmlSource?: boolean;
  files?:{id:string;name:string;mime:string;visibility?:string}[];
  compactTools?: boolean;
  preparationTools?: boolean;
  /** preparation editors only: hide the inline gallery and the formatting switch (visions and messages bring their own media) */
  inlineGallery?: boolean;
  proseClassName?: string;
  previewValue?: string;
  disabled?: boolean;
}) {
  const [initialSource]=useState(()=>value.startsWith(richHtmlPrefix)?{raw:value.slice(richHtmlPrefix.length),...inspectRichTextSource(value.slice(richHtmlPrefix.length),maximumPlainLength)}:null);
  const [htmlMode,setHtmlMode]=useState(initialSource!==null),[htmlDraft,setHtmlDraft]=useState(initialSource?.raw??''),[htmlError,setHtmlError]=useState(initialSource?.error??''),[imageId,setImageId]=useState('');
  const [preview, setPreview] = useState(false);
  const helpId = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEditorHtml = useRef('');
  const savedRange = useRef<Range | null>(null);
  const [link, setLink] = useState("");
  const [extraTools,setExtraTools]=useState(!compactTools),[linkOpen,setLinkOpen]=useState(!compactTools),[imageOpen,setImageOpen]=useState(!compactTools),[imageSearch,setImageSearch]=useState('');
  const [plainLength, setPlainLength] = useState(initialSource?initialSource.plainLength??0:richTextToPlainText(value).length);
  const [limitExceeded, setLimitExceeded] = useState((initialSource?.plainLength??0)>maximumPlainLength);
  const initialValueRef = useRef(value.startsWith(richHtmlPrefix)?canonicalRichText(value):value);
  const canonicalValueRef=useRef(canonicalRichText(value));
  useLayoutEffect(()=>{initialValueRef.current=value.startsWith(richHtmlPrefix)?canonicalRichText(value):value;canonicalValueRef.current=canonicalRichText(value);},[value]);
  useLayoutEffect(() => {
    if (editorRef.current) {
      replaceEditorContents(editorRef.current, initialValueRef.current, Boolean(proseClassName));
      lastEditorHtml.current = editorRef.current.innerHTML;
    }
  }, [htmlMode, preview, proseClassName]);

  function commit() {
    if(disabled)return;
    const editor = editorRef.current;
    if (!editor) return;
    // A focus/blur roundtrip must not convert or dirty untouched legacy text,
    // including historical documents beyond today's formatting limits.
    if (editor.innerHTML === lastEditorHtml.current) return;
    let next:string;try{next=encodeRichText(documentFromEditor(editor));}catch(e){setHtmlError((e as Error).message);if(htmlSource)onChange(richHtmlPrefix+editor.innerHTML);return;}
    const length = richTextToPlainText(next).length;
    setPlainLength(length);
    setLimitExceeded(length > maximumPlainLength);
    setHtmlError(length > maximumPlainLength ? `Bitte kürze den sichtbaren Text auf ${maximumPlainLength} Zeichen.` : '');
    // Keep an invalid draft dirty too: saving must not silently write the previous valid value.
    if ((htmlSource || length <= maximumPlainLength) && next!==canonicalValueRef.current) onChange(next);
    lastEditorHtml.current = editor.innerHTML;
  }

  function preserveSelection(event: MouseEvent) {
    event.preventDefault();
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  }

  function command(action: string, argument?: string) {
    if(disabled)return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    document.execCommand(action, false, argument);
    savedRange.current = null;
    commit();
  }

  function tableEdit(action:'row'|'column'|'removeRow'|'removeColumn'|'header') {
    const editor=editorRef.current;if(disabled||!editor)return;
    const selection=window.getSelection(),range=savedRange.current||(selection?.rangeCount?selection.getRangeAt(0):null),element=range?.startContainer instanceof Element?range.startContainer:range?.startContainer.parentElement;
    const cell=element?.closest('td,th') as HTMLTableCellElement|null,table=cell?.closest('table');
    if(!cell||!table||!editor.contains(table)){setHtmlError('Setze den Cursor zuerst in eine Tabellenzelle.');return;}
    const row=cell.parentElement as HTMLTableRowElement;
    if(action==='row'&&table.rows.length<30){const next=table.insertRow(row.rowIndex+1);for(let i=0;i<row.cells.length;i++)next.insertCell().textContent=' ';}
    if(action==='column'&&row.cells.length<10)Array.from(table.rows).forEach(r=>{r.insertCell(Math.min(cell.cellIndex+1,r.cells.length)).textContent=' ';});
    if(action==='removeRow')row.remove();
    if(action==='removeColumn'){const index=cell.cellIndex;Array.from(table.rows).forEach(r=>r.cells[index]?.remove());}
    if(action==='header')Array.from(table.rows[0].cells).forEach(c=>{const n=document.createElement(c.tagName==='TH'?'td':'th');n.innerHTML=c.innerHTML;c.replaceWith(n);});
    savedRange.current=null;commit();
  }
  function insertLink() {
    const href = safeHref(link.trim());
    if (!href) return;
    command("createLink", href);
    setLink("");
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    if(disabled)return;
    const text = event.clipboardData.getData("text/plain");
    const sheet=text.includes('\t')?'<table><tbody>'+text.trimEnd().split(/\r?\n/).slice(0,30).map(row=>'<tr>'+row.split('\t').slice(0,10).map(cell=>'<td>'+cell.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</td>').join('')+'</tr>').join('')+'</tbody></table>':null;
    const formatted = htmlSource ? htmlTextToRichText(sheet||text)||htmlTextToRichText(event.clipboardData.getData('text/html')) : null;
    if (formatted && editorRef.current) {
      const selection = window.getSelection();
      const whole = document.createRange();
      whole.selectNodeContents(editorRef.current);
      // Chromium otherwise clones the first selected heading around the
      // incoming paragraphs. Reset only content that will be fully replaced.
      if (!whole.toString() || selection?.rangeCount && !selection.isCollapsed && selection.getRangeAt(0).toString() === whole.toString()) {
        document.execCommand('formatBlock', false, 'p');
      }
    }
    document.execCommand(formatted ? "insertHTML" : "insertText", false, formatted ? richTextToHtml(formatted, true) : text);
    commit();
  }

  function sourceChange(raw:string){
    if(disabled)return;
    setHtmlDraft(raw);
    const result=inspectRichTextSource(raw,maximumPlainLength);
    setPlainLength(result.plainLength??0);setLimitExceeded((result.plainLength??0)>maximumPlainLength);setHtmlError(result.error);
    if(!result.error&&result.value)onChange(result.value);
    else if(htmlSource)onChange(richHtmlPrefix+raw);
  }
  return <div className={`${styles.editor} ${htmlSource?styles.sourceEditor:''} ${preparationTools?styles.preparationEditor:''}`}>
    {htmlSource&&!preparationTools&&<strong className={styles.editorLabel}>{label}</strong>}
    {compactTools&&!preparationTools&&<div className={styles.toolbar}><button type="button" aria-expanded={linkOpen} onMouseDown={preserveSelection} onClick={()=>setLinkOpen(!linkOpen)}>Link</button>{advanced&&<button type="button" aria-expanded={imageOpen} onMouseDown={preserveSelection} onClick={()=>setImageOpen(!imageOpen)}>Bild</button>}<button type="button" aria-expanded={extraTools} onClick={()=>setExtraTools(!extraTools)}>Weitere Formatierung</button></div>}
    {(htmlSource||advanced&&extraTools)&&<div className={styles.toolbar} aria-label={`${label} Ansicht`}>
      <button type="button" aria-pressed={!htmlMode&&!preview} disabled={htmlMode&&!!htmlError} onClick={()=>{setPreview(false);setHtmlMode(false);}}>Visuell</button>
      <button type="button" aria-pressed={htmlMode&&!preview} onClick={()=>{if(!htmlMode)setHtmlDraft(value.startsWith(richHtmlPrefix)?value.slice(richHtmlPrefix.length):richTextToHtml(value));setPreview(false);setHtmlMode(true);}}>{htmlSource?'HTML-Quelltext':'HTML · Expertenansicht'}</button>
      {htmlSource&&<button type="button" aria-pressed={preview} disabled={!!htmlError} onClick={()=>setPreview(true)}>Vorschau</button>}
      {!preparationTools&&<small>{htmlSource?'Vorschau veröffentlicht nichts.':'Nur sichere Struktur; Bilder aus dem geschützten Dateispeicher.'}</small>}
    </div>}
    {preparationTools&&inlineGallery&&<div className={styles.preparationTools}><ProtectedImageGallery files={files} disabled={disabled||!!htmlError||preview} onOpen={preserveSelection} onSelect={id=>{const markup='<img src="/api/files?id='+id.replace(/[^a-zA-Z0-9_.-]/g,'')+'" alt="Szenenbild"><p><br></p>';if(htmlMode)sourceChange(htmlDraft+markup);else command('insertHTML',markup);}}/>{!htmlMode&&!preview&&<button type="button" aria-expanded={extraTools} onClick={()=>setExtraTools(!extraTools)}>Weitere Formatierung</button>}</div>}
    {preview?<section className={styles.preview} data-custom-prose={proseClassName ? true : undefined} aria-label={`${label} Vorschau`}><RichTextView value={previewValue ?? value} readable flowing={Boolean(proseClassName)} className={proseClassName}/></section>:htmlMode?<>
      <textarea disabled={disabled} aria-label={label+' HTML'} aria-describedby={preparationTools?undefined:helpId} aria-invalid={!!htmlError} spellCheck={false} value={htmlDraft} onChange={e=>sourceChange(e.target.value)} rows={16}/>
      {htmlSource&&!preparationTools&&<p className={styles.sourceHelp} id={helpId}>Erlaubt: Überschriften, Absätze, Hervorhebungen, Listen, Zitate, Links, Trennlinien, Tabellen mit Kopfzeilen und aufklappbare Abschnitte. Klassen: <code>cp-intro</code>, <code>cp-highlight</code>, <code>cp-note</code>, <code>cp-divider</code>. Beispiel: <code>{'<p class="cp-intro">Ein erster Eindruck.</p>'}</code></p>}
    </>:<>
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
      {((htmlSource&&!preparationTools)||advanced&&extraTools)&&<><button type="button" onMouseDown={preserveSelection} onClick={()=>command('formatBlock','<blockquote>')}>Zitat</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHorizontalRule')}>Trennlinie</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHTML','<table><tbody><tr><th>Spalte 1</th><th>Spalte 2</th></tr><tr><td>Inhalt</td><td>Inhalt</td></tr></tbody></table><p><br></p>')}>Tabelle</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHTML','<details><summary>Weiterlesen</summary><p>Beschreibung</p></details><p><br></p>')}>Aufklappbarer Abschnitt</button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertHTML','<p class="cp-note">Hinweis</p>')}>Hinweiskasten</button></>}
      <label className={styles.colorControl}><span>Textfarbe</span><select aria-label="Textfarbe" defaultValue="#d6b36f" onMouseDown={()=>{const selection=window.getSelection();if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange();}} onChange={event => command("foreColor", event.target.value)}>{richTextColors.map(color => <option key={color} value={color}>{color === "#d6b36f" ? "Gold" : color === "#eee6d6" ? "Elfenbein" : color === "#a9c3cf" ? "Nebelblau" : "Rostrot"}</option>)}</select></label>
    </div>
    {htmlSource&&(!preparationTools||extraTools)&&!htmlMode&&!preview&&<div className={styles.toolbar} aria-label="Tabelle bearbeiten">{([['row','Zeile +'],['column','Spalte +'],['removeRow','Zeile entfernen'],['removeColumn','Spalte entfernen'],['header','Kopfzeile']] as const).map(([action,title])=><button type="button" key={action} onMouseDown={preserveSelection} onClick={()=>tableEdit(action)}>{title}</button>)}</div>}
    {!preparationTools&&linkOpen&&<div className={styles.linkRow}><label><span>Link zur Auswahl</span><input type="text" value={link} onChange={event => setLink(event.target.value)} onMouseDown={() => { const selection = window.getSelection(); if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange(); }} placeholder={advanced?"https://… oder /sl/command-center?story=…":"https://…"}/></label><button type="button" onMouseDown={preserveSelection} onClick={insertLink}>Link setzen</button></div>}
    {!preparationTools&&advanced&&imageOpen&&<div className={styles.linkRow}><label>Geschütztes Bild<input aria-label={label+' Bilder suchen'} placeholder="Dateiname oder ID …" value={imageSearch} onChange={e=>setImageSearch(e.target.value)}/><select aria-label={label+' Bild'} value={imageId} onChange={e=>setImageId(e.target.value)}><option value="">Vorhandenes Bild auswählen</option>{files.filter(f=>f.mime.startsWith('image/')&&(f.name+' '+f.id).toLowerCase().includes(imageSearch.toLowerCase())).map(f=><option key={f.id} value={f.id}>{f.name} · {f.id}{f.visibility ? ` · Dateiregel: ${f.visibility==='group'?'Gruppe':f.visibility==='sl'?'SL':'Eigentümer'}` : ''}</option>)}</select></label><button type="button" disabled={!imageId} onMouseDown={preserveSelection} onClick={()=>{command('insertHTML','<img src="/api/files?id='+imageId.replace(/[^a-zA-Z0-9_.-]/g,'')+'" alt="SL-Unterlage"><p><br></p>');setImageId('');}}>Bild einfügen</button></div>}
    {!preparationTools&&advanced&&imageOpen&&imageId&&<figure><img src={'/api/files?id='+encodeURIComponent(imageId)} alt="Vorschau des ausgewählten geschützten Bildes" style={{maxWidth:180,maxHeight:140,objectFit:'contain'}}/><figcaption>Geschützter Dateispeicher · Dateiregel: {files.find(file=>file.id===imageId)?.visibility==='group'?'Gruppe':files.find(file=>file.id===imageId)?.visibility==='sl'?'SL':files.find(file=>file.id===imageId)?.visibility==='private'?'Eigentümer':'nicht angegeben'}. Auswahl veröffentlicht nichts; der Server prüft den tatsächlichen Zugriff.</figcaption></figure>}
    <div
      ref={editorRef}
      className={[styles.editable,proseClassName].filter(Boolean).join(' ')}
      contentEditable={!disabled}
      aria-readonly={disabled||undefined}
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
    <div className={styles.editorFooter}><span role={limitExceeded?"alert":undefined}>{limitExceeded?`Text zu lang: kürze auf höchstens ${maximumPlainLength} Zeichen, bevor du speicherst.`:htmlSource?"Gezählt wird nur sichtbarer Text. HTML wird sicher aufbereitet; die bestehende Freigabe bleibt unverändert.":advanced?"HTML wird als sichere Dokumentstruktur gespeichert; Scripts und externe Einbettungen entfallen.":"Überschriften, Listen, Hervorhebungen, Links und Kampagnenfarben."}</span><small data-over-limit={limitExceeded}>{plainLength}/{maximumPlainLength}</small></div>
  </div>;
}

export { richTextToPlainText };
