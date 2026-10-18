import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeRichText,htmlToRichText,inspectRichTextSource,isRichTextWithinLimit,parseRichTextDocument,readRichText,richHtmlPrefix,richTextClasses,richTextToHtml,richTextToPlainText,sanitizeRichTextInput} from '../domain/location-rich-text.ts';
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
  assert.ok(view.includes('currentArea.playerHint} readable'));
  assert.ok(view.includes('aria-label={`Bild vergrößern: ${currentArea.title}`}'));
  assert.ok(view.includes('boundedImageOffset'));
  assert.ok(view.includes('preventScroll:true'));
  assert.match(css,/grid-template-columns: 260px minmax\(0,1fr\)/);
  assert.match(css,/\.areasSection \{ grid-column: 1 \/ -1/);
  assert.match(css,/\.areaImageButton > img[^}]*object-fit: contain/s);
  assert.match(css,/\.imageStage > img[^}]*object-fit: contain/s);
  assert.match(editor,/<RichTextEditor htmlSource[^\n]*maximumPlainLength=\{1200\}/);
});
