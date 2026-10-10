"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BookOpen,ChevronLeft,ChevronRight,Search,Lock,Library} from 'lucide-react';
import {editions,editionLabels,sourceLabel,type Book,type Chapter,type Contents,type Edition,type Hit,type Section} from '@/domain/codex';
import styles from './codex.module.css';

async function request<T>(query:string,signal?:AbortSignal):Promise<T>{
  const r=await fetch('/api/codex'+query,{signal,cache:'no-store'});
  const data=await r.json() as T&{error?:string};if(!r.ok)throw Error(data.error??'Bibliothek nicht erreichbar.');return data;
}
type Position={book:string;chapter:string;section?:string;scroll?:number};
function readPosition(key:string):Position|null{try{return JSON.parse(sessionStorage.getItem(key)??'null');}catch{return null;}}
function location(p:Position|null){const url=new URL(window.location.href);for(const k of ['codexBook','codexChapter','codexSection'])url.searchParams.delete(k);if(p){url.searchParams.set('codexBook',p.book);url.searchParams.set('codexChapter',p.chapter);if(p.section)url.searchParams.set('codexSection',p.section);}window.history.replaceState(null,'',url);}
function Text({section:s,book,chapter}:{section:Section;book:Book;chapter:string}){
  const [imageError,setImageError]=useState(false);
  const [zoom,setZoom]=useState(false);
  const text=s.runs.map((r,i)=>{const t=r.text.replaceAll('\v','\n');return r.bold?<strong key={i}>{r.italic?<em>{t}</em>:t}</strong>:r.italic?<em key={i}>{t}</em>:<span key={i}>{t}</span>;});
  if(s.kind==='page')return <figure className={styles.pdfPage}>
    <figcaption>{sourceLabel(s.source)} · Originalseite</figcaption>
    <button type="button" className="button" aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>{zoom?'Seite einpassen':'Originalseite vergrößern'}</button>
    <div className={styles.pageViewport} tabIndex={zoom?0:undefined} aria-label={zoom?'Vergrößerte Originalseite, horizontal scrollbar':undefined}>
    {imageError?<p role="alert">Originalseite konnte nicht geladen werden. Bitte das Kapitel erneut öffnen.</p>:
      // Already prepared offline; the authenticated image must never use a public optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={zoom?styles.zoomPage:undefined} width={1200} height={s.pageSize?Math.round(1200*s.pageSize.height/s.pageSize.width):undefined} src={'/api/codex?book='+encodeURIComponent(book.id)+'&chapter='+encodeURIComponent(chapter)+'&page='+s.source.page} alt={sourceLabel(s.source)+' des Regelwerks '+book.title} loading="lazy" decoding="async" onError={()=>setImageError(true)}/>}
    </div>
    <details><summary>Textschicht dieser Seite (Suchindex)</summary><p>Unveränderte Extraktion; für Tabellen und Lesereihenfolge ist die Originalseite verbindlich.</p><pre>{s.runs.some(r=>r.text.trim())?text:'Keine Textschicht vorhanden. Die vollständige Originalseite wird oben angezeigt.'}</pre>
      {s.ocrText!==undefined&&<><p>Ergänzende OCR-Suchhilfe · ungeprüft, kann Erkennungsfehler enthalten. Kein verbindlicher Regeltext.</p><pre>{s.ocrText||'Keine Zeichen erkannt.'}</pre></>}
    </details>
  </figure>;
  if(s.kind==='table')return <div className={styles.tableScroll} tabIndex={0} aria-label="Regeltabelle, horizontal scrollbar"><table><caption>Regelübersicht · Originalstruktur beibehalten</caption><thead><tr>{s.rows[0]?.map((c,i)=><th scope="col" key={i}>{c}</th>)}</tr></thead><tbody>{s.rows.slice(1).map((row,i)=><tr key={i}>{row.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  if(s.kind==='heading')return s.level<=2?<h2>{text}</h2>:<h3>{text}</h3>;
  if(s.kind==='bullet')return <p className={styles.bullet}><span aria-hidden="true">◆</span><span>{text}</span></p>;
  return <><p className={s.runs.map(r=>r.text).join('').startsWith('Merke:')?styles.ruleBox:undefined}>{text}</p>{s.separators?.map((kind,i)=>kind==='horizontalRule'?<hr key={i}/>:<small className={styles.source} key={i}>Seitenumbruch der Quelle</small>)}</>;
}
export function CodexPanel({dataScope}:{dataScope:string}){
  const key='codex-position:'+dataScope;
  const [books,setBooks]=useState<Book[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [query,setQuery]=useState(''),[edition,setEdition]=useState<Edition|''>(''),[hits,setHits]=useState<Hit[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState('');
  const [toc,setToc]=useState<Contents|null>(null),[chapter,setChapter]=useState<Chapter|null>(null),[readerLoading,setReaderLoading]=useState(false),[notice,setNotice]=useState('');
  const [position,setPosition]=useState<Position|null>(null);
  const [releaseBusy,setReleaseBusy]=useState<string|null>(null);
  const reader=useRef<HTMLElement>(null),operation=useRef({id:0}),searchOperation=useRef(0),restored=useRef(false);
  async function releaseBook(b:Book){
    setReleaseBusy(b.id);setNotice('');
    try{const r=await fetch('/api/codex',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({book:b.id,playerReleased:!b.playerReleased})});const d=await r.json() as {book:Book;error?:string};if(!r.ok)throw Error(d.error??'Freigabe fehlgeschlagen.');setBooks(current=>current.map(old=>old.id===b.id?d.book:old));setToc(current=>current?.book.id===b.id?{...current,book:d.book}:current);searchOperation.current++;setHits([]);setQuery('');setSearching(false);setNotice(d.book.playerReleased?'Buch vollständig für Spieler freigegeben.':'Spielerfreigabe entzogen.');}catch(e){setNotice(e instanceof Error?e.message:'Freigabe fehlgeschlagen.');}finally{setReleaseBusy(null);}
  }
  useEffect(()=>{
    if(query.trim().length<2)return;
    const controller=new AbortController(),op=searchOperation.current;
    const current=()=>!controller.signal.aborted&&op===searchOperation.current;
    const timer=setTimeout(()=>{request<{hits:Hit[]}>('?q='+encodeURIComponent(query)+(edition?'&edition='+edition:''),controller.signal).then(d=>{if(current())setHits(d.hits);}).catch(e=>{if(current())setSearchError(e.message);}).finally(()=>{if(current())setSearching(false);});},250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,edition]);
  useEffect(()=>{
    if(!position)return;
    const save=()=>{try{sessionStorage.setItem(key,JSON.stringify({...position,scroll:window.scrollY}));}catch{}};
    const timer=setInterval(save,1500);return ()=>{clearInterval(timer);save();};
  },[key,position]);
  useEffect(()=>{
    if(!chapter||!position)return;
    // Wait for React's committed chapter DOM, not a timer racing its render.
    const target=position.section?document.getElementById(position.section):reader.current;
    const offset=['.player-topbar','.player-nav'].reduce((n,selector)=>n+(document.querySelector(selector)?.getBoundingClientRect().height??0),16);
    if(target)target.style.scrollMarginTop=offset+'px';
    target?.focus({preventScroll:true});
    if(position.scroll!==undefined)window.scrollTo(0,position.scroll);
    else target?.scrollIntoView({block:'start',behavior:'instant'});
  },[chapter,position]);
  const open=useCallback(async (book:Book,p?:Position)=>{
    if(!book.readerReady){setNotice('Nur Metadaten: Inhalte bleiben gesperrt, bis Nutzungsrechte und Freigabe geklärt sind.');return;}
    const op=++operation.current.id;setReaderLoading(true);setError('');setNotice('');
    try{
      const contents=await request<Contents>('?book='+encodeURIComponent(book.id));if(op!==operation.current.id)return;
      const first=contents.chapters.find(c=>c.id===p?.chapter)??contents.chapters[0];
      if(!first)throw Error('Für dich sind noch keine Kapitel freigegeben.');
      const loaded=await request<{chapter:Chapter}>('?book='+encodeURIComponent(book.id)+'&chapter='+encodeURIComponent(first.id));if(op!==operation.current.id)return;
      const next={book:book.id,chapter:first.id,section:p?.section,scroll:p?.scroll};
      setToc(contents);setChapter(loaded.chapter);setPosition(next);location(next);
    }catch(e){if(op===operation.current.id){setToc(null);setChapter(null);setPosition(null);setError(e instanceof Error?e.message:'Reader nicht erreichbar.');}}
    finally{if(op===operation.current.id)setReaderLoading(false);}
  },[]);
  useEffect(()=>{
    const controller=new AbortController(),gate=operation.current;
    request<{books:Book[]}>('',controller.signal).then(d=>{
      if(controller.signal.aborted)return;
      setBooks(d.books);setError('');
      if(!restored.current){
        restored.current=true;
        const p=new URL(window.location.href).searchParams,id=p.get('codexBook'),chapter=p.get('codexChapter');
        const b=d.books.find(b=>b.id===id);
        if(b&&chapter)void open(b,{book:b.id,chapter,section:p.get('codexSection')??undefined});
      }
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>{controller.abort();gate.id++;};
  },[retry,open]);
  function close(){operation.current.id++;setToc(null);setChapter(null);setPosition(null);setReaderLoading(false);setError('');location(null);}
  function changeQuery(value:string){searchOperation.current++;setQuery(value);setHits([]);setSearchError('');setSearching(value.trim().length>=2);}
  function changeEdition(value:Edition|''){searchOperation.current++;setEdition(value);setHits([]);setSearchError('');setSearching(query.trim().length>=2);}
  const resume=books.length?readPosition(key):null;
  const selected=toc?.chapters.findIndex(c=>c.id===chapter?.id)??-1;
  return <section className={styles.codex} aria-label="Digitale Regelbibliothek">
    <header className={styles.masthead}><div><p className={styles.eyebrow}>CHRONIPLAY · REGELBIBLIOTHEK</p><h1>Codex Noctis</h1><p>Wissen der Nacht. Getrennte Editionen. Verlässliche Fundstellen.</p></div><Library aria-hidden="true" size={44}/></header>
    {books.some(b=>b.publicationBasis==='operator_pre_alpha'&&b.rights==='pending')&&<p className={styles.notice}>Geschlossene Pre-Alpha · Bereitstellung aufgrund dokumentierter Betreiberentscheidung. Die Nutzungsrechte dieser Werke sind weiterhin ungeklärt; die Freigabe ist kein Lizenznachweis.</p>}
    <div className={styles.searchBar}><label><span>Regeln durchsuchen</span><div><Search size={18} aria-hidden="true"/><input type="search" value={query} onChange={e=>changeQuery(e.target.value)} placeholder="Begriff, z. B. Willenskraft" maxLength={200}/></div></label><label><span>Edition</span><select value={edition} onChange={e=>changeEdition(e.target.value as Edition|'')}><option value="">Alle Editionen</option>{editions.map(e=><option key={e} value={e}>{editionLabels[e]}</option>)}</select></label></div>
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {books.some(b=>b.canManage)&&<details className={styles.notice}><summary>Buchfreigaben für Spieler</summary><p>Freigabe umfasst alle Kapitel und Originalansichten. SL-interne Bücher bleiben ohne ausdrückliche Freigabe geschützt. Nutzungsrechte werden hier nicht bestätigt.</p>{books.map(b=><div key={b.id}><span>{b.title} · {b.playerReleased?'Freigegeben':'SL-intern'}</span> <button type="button" className="button" disabled={releaseBusy!==null||(!b.playerReleased&&!b.canRelease)} onClick={()=>void releaseBook(b)} aria-label={(b.playerReleased?'Spielerfreigabe entziehen: ':'Für Spieler freigeben: ')+b.title}>{b.playerReleased?'Freigabe entziehen':b.canRelease?'Für Spieler freigeben':'Nutzungsberechtigung offen'}</button></div>)}</details>}
    <p><Link href="/impressum">Impressum</Link> · <Link href="/datenschutz">Datenschutz</Link></p>
    {error&&<div role="alert" className={styles.notice}>{error} <button className="button" onClick={()=>{close();setLoading(true);setRetry(r=>r+1);}}>Erneut versuchen</button></div>}
    {query.trim().length>=2&&<section className={styles.results} aria-label="Suchergebnisse"><h2>Fundstellen</h2>{searching?<p role="status">Suche im vorbereiteten Index …</p>:searchError?<p role="alert">{searchError}</p>:!hits.length?<p>Keine freigegebenen Fundstellen. Bücher ohne Inhaltsfreigabe werden nicht durchsucht.</p>:<><p role="status">{hits.length} Treffer{hits.length===30?' (maximal 30 angezeigt)':''}</p>{hits.map(h=><button type="button" key={h.bookId+h.sectionId} onClick={()=>{const b=books.find(b=>b.id===h.bookId);if(b)void open(b,{book:h.bookId,chapter:h.chapterId,section:h.sectionId});}}><span className={styles.eyebrow}>{editionLabels[h.edition]} · {h.title}</span><strong>{h.chapter} / {h.heading}</strong><span>{h.snippet}</span><small>{sourceLabel(h.source)}</small></button>)}</>}</section>}
    {readerLoading&&<p role="status">Kapitel wird geladen …</p>}
    {toc&&chapter?<><button type="button" className="button" onClick={close}><ArrowLeft size={16}/>Zur Bibliothek</button>{toc.book.reviewOnly&&<p className={styles.notice}>SL-ANSICHT · Für Spieler nicht freigegeben. Nutzungsrechte werden gesondert bestätigt.</p>}{toc.book.quality&&<p className={styles.notice}>{toc.book.quality}</p>}<div className={styles.readerLayout}><aside><details open><summary>Inhaltsverzeichnis</summary>{!!toc.outline?.length&&<nav aria-label="Original-Inhaltsverzeichnis">{toc.outline.map((b,i)=><button className={b.level>1?styles.bookmark:undefined} key={i} onClick={()=>void open(toc.book,{book:toc.book.id,chapter:b.chapterId,section:b.sectionId})}>{b.title}</button>)}</nav>}<details open={!toc.outline?.length||toc.book.format!=='PDF'}><summary>Kapitelteile / Seitenbereiche</summary><nav aria-label="Kapitel">{toc.chapters.map(c=><div key={c.id}><button aria-current={c.id===chapter.id?'page':undefined} onClick={()=>void open(toc.book,{book:toc.book.id,chapter:c.id})}>{c.title}</button>{c.bookmarks?.map((b,i)=><button className={styles.bookmark} key={i} onClick={()=>void open(toc.book,{book:toc.book.id,chapter:c.id,section:b.sectionId})}><span aria-hidden="true">↳ </span>{b.title}</button>)}</div>)}</nav></details></details><p>{editionLabels[toc.book.edition]} · {toc.book.type}</p><small>{toc.book.format==='PDF'?'Quell-Inhaltsverzeichnis; ohne belegte Gliederung ausdrücklich Seitenbereiche.':'Native Google-Docs-Fundstellen, keine feste PDF-Seitenzählung.'}</small></aside><article ref={reader} tabIndex={-1} className={styles.reader}><header><p className={styles.eyebrow}>{editionLabels[toc.book.edition]} · {toc.book.reviewOnly?'SL-PRÜFANSICHT':toc.book.type}</p><h2>{toc.book.title}</h2><p>{chapter.title}</p></header>{chapter.sections.map(s=><section id={s.id} tabIndex={-1} key={s.id} className={styles.readerSection}><Text section={s} book={toc.book} chapter={chapter.id}/>{(s.kind==='heading'||s.kind==='table')&&<small className={styles.source}>{sourceLabel(s.source)}</small>}</section>)}<footer><p>Quelle unverändert übernommen · Stand {toc.book.modified.slice(0,10)}</p><small>SHA-256 {toc.book.hash}</small><div className={styles.chapterPager}><button className="button" disabled={selected<=0||readerLoading} onClick={()=>void open(toc.book,{book:toc.book.id,chapter:toc.chapters[selected-1].id})}><ChevronLeft size={16}/>Vorheriges Kapitel</button><button className="button" disabled={selected>=toc.chapters.length-1||readerLoading} onClick={()=>void open(toc.book,{book:toc.book.id,chapter:toc.chapters[selected+1].id})}>Nächstes Kapitel<ChevronRight size={16}/></button></div></footer></article></div></>:!loading&&!readerLoading&&<>{resume&&books.some(b=>b.id===resume.book&&b.readerReady)&&<button className="button" onClick={()=>{const b=books.find(b=>b.id===resume.book);if(b)void open(b,resume);}}>An letzter Leseposition weiterlesen</button>}{editions.filter(e=>!edition||edition===e).map(e=><section key={e} className={styles.shelf}><h2>{editionLabels[e]}</h2><div className={styles.books}>{books.filter(b=>b.edition===e).map(b=><button type="button" key={b.id} className={styles.book} data-edition={e} onClick={()=>void open(b)}><span className={styles.cover}><span className={styles.edition}>{editionLabels[e]}</span><BookOpen size={38} aria-hidden="true"/><strong>{b.title.replace(/\.pdf$/i,'')}</strong><span className={styles.bookType}>{b.type}</span><span className={styles.seal}>{b.readerReady?'Im Codex lesen':<><Lock size={13}/>Metadaten</>}</span></span><span className={styles.bookMeta}>{b.format} · {b.reviewOnly?'SL-Ansicht':b.readerReady?'Inhalte freigegeben':'Nutzungsrechte offen'}</span></button>)}</div></section>)}</>}
    {loading&&<p role="status">Bibliothek wird geladen …</p>}
    {!loading&&!books.length&&!error&&<p>Noch keine Regelwerke freigegeben.</p>}
  </section>;
}
