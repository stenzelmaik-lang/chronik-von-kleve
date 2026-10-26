import test from 'node:test';
import assert from 'node:assert/strict';
import {slDossierChapters,slDossierEditorValue} from '../domain/location-dossier.ts';
import {encodeRichText,htmlTextToRichText,htmlToRichText,readRichText,richHtmlPrefix,richTextToHtml,richTextToPlainText} from '../domain/location-rich-text.ts';

const overview='<p class="cp-intro">Die <strong>Empfangshalle</strong>.<br>Zweite Zeile.</p>\n<h3>Auf einen Blick</h3>\n<ul><li>Vorplatz</li><li>Personal</li></ul>\n<hr class="cp-divider">\n<p class="cp-note">Nur SL.</p>';
const architecture='<p>Erster Absatz.</p>\n<p>Zweiter Absatz mit <em>Hervorhebung</em>.</p>\n<h3>Galerie</h3>\n<ul><li>Westtreppe</li><li>Osttreppe</li></ul>';
const literalBlocks=html=>html.split('\n').map(text=>({type:'paragraph',children:[{text}]}));
const affected=encodeRichText({version:1,blocks:[{type:'heading2',children:[{text:'Schnellübersicht'}]},...literalBlocks(overview),{type:'heading2',children:[{text:'Architektur und räumlicher Aufbau'}]},...literalBlocks(architecture)]});

test('Previously pasted literal HTML is safely readable inside the existing SL chapters without rewriting storage',()=>{
 const original=affected,chapters=slDossierChapters(affected);
 assert.deepEqual(chapters.map(c=>c.title),['Schnellübersicht','Architektur und räumlicher Aufbau']);
 const html=chapters.map(c=>richTextToHtml(c.content)).join('\n');
 for(const token of ['<p class="cp-intro">','<strong>','<br>','<h3>','<ul>','<li>','cp-note','cp-divider'])assert.ok(html.includes(token),token);
 assert.ok(!html.includes('&lt;p')&&!html.includes('&lt;ul'));
 assert.equal(affected,original);
 assert.equal(slDossierEditorValue(affected),htmlToRichText('<h2>Schnellübersicht</h2>'+overview+'<h2>Architektur und räumlicher Aufbau</h2>'+architecture));
});

test('Raw historical HTML and explicit HTML source use the same sanitized SL reader',()=>{
 const html='<h2>Schnellübersicht</h2>'+overview+'<h2>Architektur und räumlicher Aufbau</h2>'+architecture;
 for(const value of [html,richHtmlPrefix+html]){
  const chapters=slDossierChapters(value);
  assert.equal(chapters.length,2);assert.equal(chapters[0].overview,true);
  assert.ok(richTextToHtml(chapters[1].content).includes('<ul>'));
  assert.ok(!chapters[0].searchText.includes('<strong>'));
 }
});

test('Recovered SL HTML cannot execute scripts or fetch unapproved embeds',()=>{
 const source='<p onclick="evil()">Text<script>DO_NOT_RUN</script><a href="javascript:evil()">Link</a></p>\n<iframe src="https://evil.invalid"></iframe>\n<p class="cp-note">Ende</p>';
 const value=encodeRichText({version:1,blocks:literalBlocks(source)});
 const safe=richTextToHtml(slDossierChapters(value)[0].content);
 assert.ok(safe.includes('cp-note'));
 for(const token of ['onclick','DO_NOT_RUN','javascript:','iframe','evil.invalid'])assert.ok(!safe.includes(token),token);
});

test('Actual plain text, literal comparisons and malformed or oversized documents retain their original fallback',()=>{
 for(const text of ['  Alttext <literal> & Zeichen.\n\nZweite Zeile.  ','A < B\n<p>als Beispiel ohne Abschluss','&lt;p&gt;Wörtliches Beispiel&lt;/p&gt;']){
  assert.equal(slDossierChapters(text)[0].content,text);
  assert.equal(slDossierEditorValue(text),text);
 }
 const complex='<p>'+'<span>'.repeat(45)+'Text'+'</span>'.repeat(45)+'</p>';
 assert.equal(slDossierChapters(complex)[0].content,complex);
});

test('Manual line breaks, blank paragraphs and SL chapter boundaries survive repeated HTML roundtrips',()=>{
 const value=htmlToRichText('<h2>Schnellübersicht</h2><p>Zeile eins<br>Zeile zwei</p><p></p><p>Neuer Absatz.</p><h2>Architektur und räumlicher Aufbau</h2><h3>Galerie</h3><p>Letzter Absatz.</p>');
 const reopened=slDossierEditorValue(value),roundtrip=htmlToRichText(richTextToHtml(reopened));
 assert.deepEqual(readRichText(roundtrip),readRichText(value));
 assert.equal(slDossierChapters(roundtrip).length,2);
 assert.ok(richTextToPlainText(slDossierChapters(roundtrip)[0].content).includes('Zeile eins\nZeile zwei\n\nNeuer Absatz.'));
});

test('Explicit pasted HTML is sanitized while ordinary text and incomplete markup remain literal',()=>{
 assert.ok(richTextToHtml(htmlTextToRichText(overview)).includes('<ul>'));
 for(const text of ['Normaler Absatz.','Vergleich A < B','<literal>Text</literal>','<p>Unvollständiges Beispiel'])assert.equal(htmlTextToRichText(text),null);
 assert.ok(!richTextToHtml(htmlTextToRichText('<p onclick="evil()">Text<script>evil()</script></p>')).includes('evil'));
});

test('Browser-created Enter and paste div lines preserve empty paragraphs and hard breaks',()=>{
 const value=htmlToRichText('<div>Erster Absatz.</div><div><br></div><div>Zweiter Absatz.<br>Weitere Zeile.</div>');
 assert.deepEqual(readRichText(value).blocks.map(b=>b.type),['paragraph','paragraph','paragraph']);
 assert.equal(richTextToPlainText(value),'Erster Absatz.\n\nZweiter Absatz.\nWeitere Zeile.');
 assert.deepEqual(readRichText(htmlToRichText(richTextToHtml(value,true))),readRichText(value));
});

test('Editor HTML uses the same flowing prose and explicit hard breaks as the SL reader',()=>{
 const value=htmlToRichText('<p>\n  Erster Satz.\n  Zweiter Satz.<br>\n  Bewusste neue Zeile.\n</p>');
 const html=richTextToHtml(value,true);
 assert.ok(html.includes('Erster Satz. Zweiter Satz.'));
 assert.ok(html.includes('<br>'));assert.ok(!html.includes('\n  '));
 const plain=encodeRichText({version:1,blocks:[{type:'paragraph',children:[{text:'Manuell\nNeue Zeile'}]}]});
 assert.equal(richTextToHtml(plain,true),'<p>Manuell<br>Neue Zeile</p>');
  const sections=htmlToRichText('<h2>Kapitel</h2><p>Absatz.</p><ul><li>Eintrag</li></ul>');
  assert.ok(!richTextToHtml(sections,true).includes('\n'),'Visual HTML must not insert whitespace nodes between blocks that browsers inherit as headings on paste');
});
