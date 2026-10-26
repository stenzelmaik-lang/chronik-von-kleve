import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSlDossierChapter, searchSlDossier, slDossierChapters, slDossierEditorValue, slDossierEntries } from '../domain/location-dossier.ts';
import { parseGmSecretPayload } from '../domain/location-cms.ts';
import { htmlToRichText, readRichText, richHtmlPrefix, richTextPrefix, richTextToHtml, richTextToPlainText } from '../domain/location-rich-text.ts';

const text='<h2>Schnellübersicht</h2><p>Zwei Zugänge. Nachts nur Personal.</p><h2>Architektur und räumlicher Aufbau</h2><p class="cp-intro">Die <strong>hohe Halle</strong>.</p><h3>Galerie</h3><ul><li>Westtreppe</li><li>Osttreppe</li></ul><h2>Technik und Sicherheit</h2><table><tr><th>Tür</th><th>Status</th></tr><tr><td>West</td><td>Geschlossen</td></tr></table><blockquote class="cp-note">Nur SL.</blockquote>';
const encoded=htmlToRichText(text);
const projection={view:'sl',actualRole:'gm',canSwitchToSl:true,target:'group',location:{id:'place.station',title:'Hauptbahnhof Kleve',areas:[{viewKey:'area.hall',title:'Empfangshalle',rooms:[{viewKey:'room.office',title:'Dienstzimmer'}]},{viewKey:'area.secret',title:'Interner Gang',rooms:[]}],knownInformation:[{id:'clue.public',title:'Öffentlich',text:'PUBLIC_ONLY',visibility:'group'},{id:'clue.private',title:'Verborgener Hinweis',text:'PRIVATE_CLUE',visibility:'gm'}],slNotes:[{entityId:'area.hall',text:encoded,source:'Bestehender Vermerk'},{entityId:'room.office',text:'PRIVATE_ROOM_TEXT',source:''}]}};

test('SL plain text, literal markup and every existing line remain unchanged without a migration',()=>{
  const original='  Alter Vermerk <literal> & Zeichen.\n\nZweite Zeile.\r\nDritte Zeile.  ';
  assert.equal(parseGmSecretPayload({text:original}).text,original);
  const chapters=slDossierChapters(original);
  assert.equal(chapters.length,1);assert.equal(chapters[0].content,original);
  const longLegacy=Array.from({length:140},(_,i)=>'Zeile '+i).join('\n');
  assert.equal(slDossierChapters(longLegacy)[0].content,longLegacy);
  assert.equal(richTextToPlainText(slDossierEditorValue(longLegacy)),longLegacy);
  assert.ok(richTextToPlainText(appendSlDossierChapter(longLegacy,'Schnellübersicht')).startsWith(longLegacy));
});

test('HTML SL writes use the existing safe typed document and reject structural bypasses',()=>{
  const result=parseGmSecretPayload({text:richHtmlPrefix+text+'<script>SECRET_SCRIPT</script><p onclick="evil()"><a href="javascript:evil()">Text</a></p><iframe src="https://evil.test"></iframe>',source:'Quelle'});
  assert.ok(result.text.startsWith(richTextPrefix));
  const html=richTextToHtml(result.text);
  assert.ok(html.includes('<h2>')&&html.includes('<ul>')&&html.includes('<table>')&&html.includes('cp-note'));
  for(const unsafe of ['SECRET_SCRIPT','onclick','javascript:','iframe'])assert.ok(!html.includes(unsafe));
  assert.equal(parseGmSecretPayload({text:'x'.repeat(5001)}),null);
  assert.equal(parseGmSecretPayload({text:richHtmlPrefix+'<p>'+'x'.repeat(5001)+'</p>'}),null);
  assert.equal(parseGmSecretPayload({text:richTextPrefix+JSON.stringify({version:1,blocks:[{type:'paragraph',children:[{text:'secret',onclick:'evil'}]}]})}),null);
  assert.equal(parseGmSecretPayload({text:richHtmlPrefix+'<div>'.repeat(50)+'Text'+'</div>'.repeat(50)}),null);
});

test('Chapter grouping retains prose, nested headings, lists, tables and existing classes',()=>{
  const snapshot=encoded;
  const chapters=slDossierChapters(encoded);
  assert.deepEqual(chapters.map(c=>c.title),['Schnellübersicht','Architektur und räumlicher Aufbau','Technik und Sicherheit']);
  assert.equal(chapters[0].overview,true);assert.equal(chapters[1].overview,false);
  assert.ok(richTextToHtml(chapters[1].content).includes('cp-intro'));
  assert.ok(richTextToHtml(chapters[1].content).includes('<h3>Galerie</h3>'));
  assert.ok(readRichText(chapters[2].content).blocks.some(b=>b.type==='table'));
  const expected=readRichText(encoded).blocks.filter(b=>b.type!=='heading2');
  assert.deepEqual(chapters.flatMap(c=>readRichText(c.content).blocks),expected);
  assert.equal(encoded,snapshot);
});

test('Preamble and repeated headings remain separate rather than overwriting one another',()=>{
  const value=htmlToRichText('<p>Vorhandene Einleitung.</p><h2>Notiz</h2><p>A</p><h2>Notiz</h2><p>B</p>');
  const chapters=slDossierChapters(value);
  assert.equal(chapters.length,3);assert.equal(new Set(chapters.map(c=>c.key)).size,3);
  assert.deepEqual(chapters.map(c=>richTextToPlainText(c.content)),['Vorhandene Einleitung.','A','B']);
});

test('Appending a chapter is explicit and preserves the complete original document',()=>{
  const value=appendSlDossierChapter(encoded,'Zugänge und angrenzende Räume');
  assert.deepEqual(readRichText(value).blocks.slice(0,-2),readRichText(encoded).blocks);
  assert.equal(encoded,htmlToRichText(text));
  assert.throws(()=>appendSlDossierChapter(encoded,'Neuer Objekttyp'));
  assert.throws(()=>appendSlDossierChapter('x'.repeat(4999),'Schnellübersicht'));
  const plain='Alter Text\nWeitere Zeile';
  assert.ok(richTextToPlainText(appendSlDossierChapter(plain,'Ergänzende SL-Notizen')).startsWith(plain));
});

test('SL entries keep the same identities and parent relationships and never duplicate public prose',()=>{
  const snapshot=JSON.stringify(projection),entries=slDossierEntries(projection);
  assert.deepEqual(entries.map(e=>e.id),['place.station','area.hall','room.office','area.secret','clue.private']);
  assert.equal(entries.find(e=>e.id==='room.office').parentTitle,'Empfangshalle');
  assert.equal(entries.find(e=>e.id==='area.hall').source,'Bestehender Vermerk');
  assert.equal(entries.find(e=>e.id==='clue.private').chapters[0].content,'PRIVATE_CLUE');
  assert.ok(!JSON.stringify(entries).includes('PUBLIC_ONLY'));
  assert.equal(JSON.stringify(projection),snapshot);
});

test('Search finds chapter text, tables and rooms across the selected main place without changing source data',()=>{
  const entries=slDossierEntries(projection),snapshot=JSON.stringify(entries);
  assert.equal(searchSlDossier(entries,'geschlossen')[0].id,'area.hall');
  assert.deepEqual(searchSlDossier(entries,'geschlossen')[0].chapters.map(c=>c.title),['Technik und Sicherheit']);
  assert.equal(searchSlDossier(entries,'private_room_text')[0].id,'room.office');
  assert.ok(searchSlDossier(entries,'Empfangshalle').some(e=>e.id==='room.office'));
  assert.deepEqual(searchSlDossier(entries,'nicht vorhanden'),[]);
  assert.equal(JSON.stringify(entries),snapshot);
});

test('Player or non-SL projections never produce confidential reader entries even with forged client fields',()=>{
  assert.deepEqual(slDossierEntries({...projection,view:'player'}),[]);
  assert.deepEqual(slDossierEntries({...projection,actualRole:'player'}),[]);
  assert.deepEqual(slDossierEntries({...projection,canSwitchToSl:false}),[]);
});
