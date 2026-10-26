import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeRichText,htmlToRichText,inspectRichTextSource,isRichTextWithinLimit,parseRichTextDocument,proseInlineParts,readRichText,richHtmlPrefix,richTextClasses,richTextToHtml,richTextToPlainText,sanitizeRichTextInput,splitRichTextIntroduction} from '../domain/location-rich-text.ts';
import {parsePlayerPayload} from '../domain/location-cms.ts';

test('Server schema rejects parse errors as validation failures, never a secondary runtime exception',()=>{
  for(const raw of ['x'.repeat(65001),'<div>'.repeat(45)+'deep'+'</div>'.repeat(45)]){
    assert.equal(parsePlayerPayload('area',{title:'Bereich',playerHint:richHtmlPrefix+raw}),null);
  }
  const result=parsePlayerPayload('area',{title:'Bereich',playerHint:richHtmlPrefix+'<p class="cp-intro">Sicher</p><script>EVIL</script>'});
  assert.equal(result.playerHint,htmlToRichText('<p class="cp-intro">Sicher</p>'));
});

test('Nested HTML paragraphs in quotes retain their text boundaries',()=>{
  const saved=htmlToRichText('<blockquote><p>Erster Gedanke.</p><p>Zweiter Gedanke.</p></blockquote>');
  assert.equal(richTextToPlainText(saved),'Erster Gedanke.\nZweiter Gedanke.');
  assert.equal(richTextToHtml(htmlToRichText(richTextToHtml(saved))),richTextToHtml(saved));
});

test('Invalid source drafts retain their raw input and validation across editor remounts',()=>{
  const raw='<div>'.repeat(45)+'Noch korrigieren'+'</div>'.repeat(45),retained=richHtmlPrefix+raw;
  const restored=inspectRichTextSource(retained.slice(richHtmlPrefix.length),1200);
  assert.ok(restored.error);
  assert.equal(restored.value,undefined);
  assert.equal(parsePlayerPayload('area',{title:'Bereich',playerHint:retained}),null);
  const fixed=inspectRichTextSource('<p class="cp-intro">Korrigiert</p>',1200);
  assert.equal(fixed.error,'');
  assert.equal(fixed.plainLength,10);
  const editor=readFileSync(new URL('../app/spielbereich/modules/rich-text.tsx',import.meta.url),'utf8');
  assert.ok(editor.includes('useState(initialSource!==null)'));
  assert.ok(editor.includes("useState(initialSource?.error??'')"));
});

test('Area HTML retains supported structure and ChroniPlay classes through save/edit roundtrip',()=>{
  const source='<h2>Am Bahnsteig</h2><p class="cp-intro">Ein <strong>erster</strong> Eindruck.</p><h3>Spuren</h3><p><span class="cp-highlight">Gold</span> und <em>Stille</em>.</p><ul><li>Eins</li><li>Zwei</li></ul><ol><li>Drei</li></ol><blockquote class="cp-note">Warte hier.</blockquote><p><a href="https://example.test/quelle">Quelle</a></p><hr class="cp-divider">';
  const saved=sanitizeRichTextInput(richHtmlPrefix+source);
  assert.deepEqual(readRichText(saved).blocks.map(b=>b.type),['heading2','paragraph','heading3','paragraph','bulletList','orderedList','quote','paragraph','divider']);
  for(const name of richTextClasses)assert.ok(richTextToHtml(saved).includes(name));
  assert.equal(htmlToRichText(richTextToHtml(saved)),saved);
  assert.ok(isRichTextWithinLimit(saved,1200));
});

test('Area HTML drops active markup, handlers, IDs, arbitrary classes and executable URLs',()=>{
  const saved=htmlToRichText('<p id="location-title" onclick="EVIL()" style="background:url(https://evil.test)">Sicher <span class="cp-highlight fixed top-0" onmouseover="EVIL()">Gold</span><a href="jav&#x61;script:EVIL()">Link</a></p><script>EVIL()</script><iframe src="https://evil.test">EVIL()</iframe><svg><script>EVIL()</script></svg><style>.cp-note{display:none}</style>');
  const html=richTextToHtml(saved);
  assert.equal(richTextToPlainText(saved),'Sicher GoldLink');
  assert.match(html,/class="cp-highlight"/);
  for(const denied of ['EVIL','onclick','onmouseover','id=','fixed','top-0','style=','javascript:','evil.test','<svg','<iframe','<script'])assert.ok(!html.includes(denied),denied);
});

test('Direct document input rejects forged classes instead of trusting a client allowlist',()=>{
  const document={version:1,blocks:[{type:'paragraph',children:[{text:'Sicher',className:'cp-highlight'}],className:'cp-intro'}]};
  assert.ok(parseRichTextDocument(document));
  assert.equal(parseRichTextDocument({...document,blocks:[{...document.blocks[0],className:'cp-intro hidden'}]}),null);
  assert.equal(parseRichTextDocument({...document,blocks:[{type:'paragraph',children:[{text:'Sicher',className:'x" onclick="bad'}]}]}),null);
  assert.equal(parseRichTextDocument({...document,blocks:[{...document.blocks[0],className:{toString:'cp-intro'}}]}),null);
});

test('Formatting overhead is independent of the existing 1200 visible-character area limit',()=>{
  const raw='<p>'+Array.from({length:100},()=>'<span class="cp-highlight" style="color:#d6b36f"><strong><em><u>abcdefghij</u></em></strong></span>').join('')+'</p>';
  const saved=htmlToRichText(raw);
  assert.equal(richTextToPlainText(saved).length,1000);
  assert.ok(saved.length>1200*6+512,'The old markup-to-text ratio would reject this valid text');
  assert.equal(isRichTextWithinLimit(saved,1200),true);
  assert.equal(isRichTextWithinLimit(htmlToRichText('<p>'+'a'.repeat(1201)+'</p>'),1200),false);
  assert.equal(isRichTextWithinLimit('cvk-rich-v1:'+' '.repeat(65001),1200),false);
});

test('Plain descriptions including literal HTML and line breaks are not automatically converted',()=>{
  const old='Erster Eindruck\n\nZweiter Absatz mit <unbekannt> & Zeichen.';
  assert.equal(sanitizeRichTextInput(old),old);
  assert.equal(richTextToPlainText(old),old);
  assert.ok(richTextToHtml(old).includes('&lt;unbekannt&gt;'));
  assert.equal(richTextToPlainText(encodeRichText(readRichText(old))),old);
});

test('Area presentation isolates only the first contiguous marked introduction without losing blocks',()=>{
  const value=htmlToRichText('<h2>Vorhandener Titel</h2><p class="cp-intro">Erste <strong>Einleitung</strong>.</p><p class="cp-intro cp-note">Zweiter Einleitungsabsatz.</p><h3>Beschreibung</h3><p>Danach <span class="cp-highlight">Gold</span>.</p><blockquote class="cp-note">Ein Echo.</blockquote><hr class="cp-divider"><p class="cp-intro">Spätere Hervorhebung bleibt hier.</p>');
  const before=readRichText(value),snapshot=JSON.stringify(before);
  const split=splitRichTextIntroduction(value);
  assert.equal(richTextToPlainText(split.introduction),'Erste Einleitung.\nZweiter Einleitungsabsatz.');
  assert.deepEqual(readRichText(split.description).blocks,[before.blocks[0],...before.blocks.slice(3)]);
  assert.equal(JSON.stringify(readRichText(value)),snapshot);
  const retained=[...readRichText(split.introduction).blocks,...readRichText(split.description).blocks];
  assert.deepEqual(retained.map(b=>JSON.stringify(b)).sort(),before.blocks.map(b=>JSON.stringify(b)).sort());
});

test('Unmarked and literal plaintext descriptions stay in the description without an inferred introduction',()=>{
  for(const value of ['Alte Einleitung\n\nBeschreibung',htmlToRichText('<h2>Abschnitt</h2><p>Keine Markierung</p>'),'<p class="cp-intro">Wörtlicher Klartext</p>','']){
    assert.deepEqual(splitRichTextIntroduction(value),{introduction:null,description:value});
  }
  const partlyMarked=htmlToRichText('<p><span class="cp-intro">Markiert</span> und normal.</p>');
  assert.equal(splitRichTextIntroduction(partlyMarked).introduction,null);
});

test('A complete inline introduction and a long introduction retain all text and formatting',()=>{
  const inline=splitRichTextIntroduction(htmlToRichText('<p><span class="cp-intro">Nur <em>Einleitung</em>.</span></p><p>Beschreibung.</p>'));
  assert.equal(richTextToPlainText(inline.introduction),'Nur Einleitung.');
  assert.equal(richTextToPlainText(inline.description),'Beschreibung.');
  const longText='Die lange Einleitung bleibt vollständig lesbar. '.repeat(20);
  const value=htmlToRichText('<p class="cp-intro">'+longText+'</p><h2>Danach</h2><ul><li>Erster Hinweis</li></ul>');
  const split=splitRichTextIntroduction(value);
  assert.equal(richTextToPlainText(split.introduction),longText);
  assert.equal(richTextToHtml(split.description),'<h2>Danach</h2>\n<ul><li>Erster Hinweis</li></ul>');
  assert.equal(splitRichTextIntroduction(split.introduction).description,'');
});

test('Unsafe and oversized HTML cannot fall back to raw rendering or unbounded parsing',()=>{
  assert.throws(()=>sanitizeRichTextInput(richHtmlPrefix+'x'.repeat(65001)));
  assert.throws(()=>htmlToRichText('<div>'.repeat(45)+'Text'+'</div>'.repeat(45)));
  const attack=htmlToRichText('<a href="data:text/html,attack">Daten</a><a href="//evil.test/">Relativ</a>');
  assert.ok(!richTextToHtml(attack).includes('href='));
});

test('Area presentation reuses the safe renderer, private sources and accessible image dialog',()=>{
  const view=readFileSync(new URL('../app/spielbereich/modules/world-experience.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/spielbereich/modules/world-experience.module.css',import.meta.url),'utf8');
  const editor=readFileSync(new URL('../app/spielbereich/modules/location-cms.tsx',import.meta.url),'utf8');
  assert.ok(!view.includes('dangerouslySetInnerHTML'));
  assert.ok(view.includes('splitRichTextIntroduction(currentArea?.playerHint'));
  assert.ok(view.includes('value={areaCopy.introduction} readable'));
  assert.ok(view.includes('value={areaCopy.description} readable'));
  assert.ok(view.indexOf('value={areaCopy.introduction} readable')<view.indexOf('value={areaCopy.description} readable'));
  assert.ok(!css.includes('float:'));
  assert.match(css,/\.areaBody \{[^}]*grid-template-columns: minmax\(0,1fr\); align-items: start; gap: 28px/);
  assert.match(css,/\.areaBodyWithImage \{ grid-template-columns: minmax\(0,min\(42%,400px\)\) minmax\(0,1fr\)/);
  assert.match(css,/\.areaDetail \{[^}]*max-width: none/);
  assert.match(css,/\.areaBody \.areaHint \{[^}]*16px\/1\.6 var\(--font-sans/);
  assert.match(css,/\.areaIntroduction \{/);
  assert.match(css,/\.areaBody \.areaHint > ul \{ list-style-type: disc/);
  assert.match(css,/\.areaBody \.areaHint > ol \{ list-style-type: decimal/);
  assert.ok(view.includes('value={areaCopy.introduction} readable flowing'));
  assert.ok(view.includes('value={areaCopy.description} readable flowing'));
  assert.ok(view.includes('aria-label={`Bild vergrößern: ${currentArea.title}`}'));
  assert.ok(view.includes('boundedImageOffset'));
  assert.ok(view.includes('preventScroll:true'));
  assert.match(css,/grid-template-columns: 260px minmax\(0,1fr\)/);
  assert.match(css,/\.areasSection \{ grid-column: 1 \/ -1/);
  assert.match(css,/\.areaImageButton > img[^}]*object-fit: contain/s);
  assert.match(css,/\.imageStage > img[^}]*object-fit: contain/s);
  assert.match(editor,/<RichTextEditor htmlSource[^\n]*maximumPlainLength=\{1200\}/);
});

test('Image has its own column while all area text stays together with no flow beneath it',()=>{
  const view=readFileSync(new URL('../app/spielbereich/modules/world-experience.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/spielbereich/modules/world-experience.module.css',import.meta.url),'utf8');
  const start=view.indexOf('<div className={`${styles.areaBody}');
  const body=view.slice(start,view.indexOf('</section>}',start));
  const text=body.slice(body.indexOf('<div className={styles.areaText}>'));
  assert.ok(start>0&&body.includes('currentArea.image && !currentArea.redacted ? styles.areaBodyWithImage : ""'));
  assert.ok(body.indexOf('className={styles.areaImageButton}')<body.indexOf('className={styles.areaText}'));
  for(const expected of ['value={areaCopy.introduction}','value={areaCopy.description}','className={styles.areaContext}','className={styles.roomList}','Zu diesem Bereich sind keine Räume freigegeben.'])assert.ok(text.includes(expected));
  assert.match(css,/\.areaText \{ display: grid; align-content: start; gap: 24px; min-width: 0/);
  assert.ok(!view.includes('styles.areaOpening'));
  assert.match(css,/@media \(min-width: 1024px\) \{\s*@container area-detail \(min-width: 680px\) \{\s*\.areaBodyWithImage/);
});

test('Reading flow removes HTML indentation without rewriting stored text or inline marks',()=>{
  const value=htmlToRichText('<p>\n  Ein <strong>ruhiger</strong> Ort mit\n  Türen und <em>Licht</em>.\n</p>');
  const parts=readRichText(value).blocks[0].children,snapshot=JSON.stringify(parts);
  const reading=proseInlineParts(parts);
  assert.equal(reading.map(p=>p.text).join(''),'Ein ruhiger Ort mit Türen und Licht.');
  assert.ok(reading.some(p=>p.text==='ruhiger'&&p.bold));
  assert.ok(reading.some(p=>p.text==='Licht'&&p.italic));
  assert.equal(JSON.stringify(parts),snapshot);
  assert.ok(richTextToPlainText(value).includes('\n  Türen'));
});

test('Reading flow preserves explicit and ambiguous breaks including after HTML export/reimport',()=>{
  for(const source of ['<p>A<br>B</p>','<p><strong>A<br><br>B</strong></p>','<p>A<br> B</p>','<p><em>A<br>  B</em></p>','<p>A<br>\tB</p>']){
    const original=htmlToRichText(source),roundtrip=htmlToRichText(richTextToHtml(original));
    const text=value=>proseInlineParts(readRichText(value).blocks[0].children).map(p=>p.text).join('');
    assert.equal(text(original),text(roundtrip));
    assert.ok(text(original).includes('\n'));
    if(source.includes('<br><br>'))assert.equal(text(original),'A\n\nB');
    assert.equal(richTextToPlainText(roundtrip),richTextToPlainText(original));
    assert.ok(richTextToHtml(roundtrip).includes('<br>'));
  }
  assert.deepEqual(proseInlineParts([{text:'A\nB'}]),[{text:'A'},{text:'\n'},{text:'B'}]);
});

test('Reading flow handles CRLF/tabs and preserves punctuation, inline spaces and NBSP',()=>{
  const value=htmlToRichText('<p>\r\n\tEin <strong>Ort</strong>, <em>zwei</em>\r\n\tWege und A&nbsp;B.\r\n</p>');
  const parts=readRichText(value).blocks[0].children;
  assert.equal(proseInlineParts(parts).map(p=>p.text).join(''),'Ein Ort, zwei Wege und A\u00a0B.');
  assert.equal(proseInlineParts([{text:'vor '},{text:'Gold',bold:true},{text:' danach'}]).map(p=>p.text).join(''),'vor Gold danach');
});

test('Flow is opt-in only and does not replace the editor, plain text or safe renderer',()=>{
  const renderer=readFileSync(new URL('../app/spielbereich/modules/rich-text.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/spielbereich/modules/rich-text.module.css',import.meta.url),'utf8');
  assert.ok(renderer.includes('flowing = false'));
  assert.ok(renderer.includes('if (flowing && value.startsWith(richTextPrefix))'));
  assert.ok(renderer.includes('parseRichTextDocument(JSON.parse'));
  assert.match(css,/\.content\[data-rich-flow="prose"\] :is\(p, blockquote, li, td\) \{ white-space: normal/);
  assert.ok(renderer.includes('<RichTextView value={value} readable/>'),'Editor preview retains its existing rendering');
});
