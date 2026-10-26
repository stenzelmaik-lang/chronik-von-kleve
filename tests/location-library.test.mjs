import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterDataSchema,mediaDataSchema,locationChapterBody,parseLocationItemContent} from '../domain/location-library.ts';
import {encodeRichText,htmlToRichText,richTextToHtml,richTextToPlainText,readRichText,parseRichTextDocument,richHtmlPrefix} from '../domain/location-rich-text.ts';
test('independent location chapters support 25000 visible characters and reject oversized or invalid rich documents',()=>{
  for(const body of ['x'.repeat(25000),htmlToRichText('<p>'+'x'.repeat(25000)+'</p>')])assert.equal(chapterDataSchema.safeParse({title:'Architektur',body}).success,true);
  assert.equal(chapterDataSchema.safeParse({title:'Architektur',body:'x'.repeat(25001)}).success,false);
  assert.equal(chapterDataSchema.safeParse({title:'Architektur',body:richHtmlPrefix+'<p onclick="bad()">Gut</p><script>Geheimscript</script>'}).data?.body.includes('Geheimscript'),false);
});
test('table headers, details, paragraphs and controlled classes survive safe roundtrips',()=>{
  const value=htmlToRichText('<p class="cp-intro unsafe">Einleitung</p><details onclick="bad()"><summary>Technik</summary><h3>Sicherheit</h3><p class="cp-note">Erster Absatz</p><p>Zweiter Absatz</p><table><tr><th>Tür</th><th>Zustand</th></tr><tr><td>West</td><td>Offen</td></tr></table></details>');
  const html=richTextToHtml(value);assert.ok(html.includes('<details>'));assert.ok(html.includes('<th>Tür</th>'));assert.ok(!html.includes('onclick')&&!html.includes('unsafe'));
  assert.deepEqual(readRichText(htmlToRichText(html)),readRichText(value));assert.ok(richTextToPlainText(value).includes('Erster Absatz\nZweiter Absatz'));
  let document={version:1,blocks:[]};for(let i=0;i<6;i++)document={version:1,blocks:[{type:'details',summary:'Nested',content:document}]};assert.equal(parseRichTextDocument(document),null);
});
test('chapter heading suppression affects only matching leading H2 and preserves saved content',()=>{
  const body=htmlToRichText('<h2>Architektur</h2><p>Inhalt</p><h2>Eigenes Unterkapitel</h2><p>Weiterer Text</p>');
  const original=body,shown=locationChapterBody('Architektur',body);assert.equal(body,original);assert.equal(readRichText(shown).blocks[0].type,'paragraph');assert.ok(richTextToHtml(shown).includes('Eigenes Unterkapitel'));
  assert.equal(locationChapterBody('Anderer Titel',body),body);
});
test('SL plans can never be player released and malformed media envelopes fail closed',()=>{
  const data={title:'Plan',fileId:'00000000-0000-4000-8000-000000000001',mediaType:'sl_plan',playerReleased:true};assert.equal(mediaDataSchema.safeParse(data).success,false);
  assert.equal(parseLocationItemContent('{broken','location_media'),null);assert.equal(parseLocationItemContent(JSON.stringify({version:1,updatedAt:'now',data}),'location_media'),null);
  assert.equal(parseLocationItemContent(JSON.stringify({version:0,updatedAt:'now',data:{title:'x',body:''}}),'location_sl_chapter'),null);
  assert.ok(encodeRichText({version:1,blocks:[{type:'paragraph',children:[{text:'x'.repeat(25000)}]}]}));
});
