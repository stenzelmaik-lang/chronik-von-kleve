import test from 'node:test';
import assert from 'node:assert/strict';
import {htmlToRichText,readRichText,richTextToHtml,parseRichTextDocument} from '../domain/location-rich-text.ts';

const blocks=html=>readRichText(htmlToRichText(html)).blocks;

test('any colour from the colour wheel survives, unsafe colour values do not', () => {
  const [p]=blocks('<p><font color="#3a7bd5">Blau</font> <span style="color:rgb(18, 200, 90)">Grün</span> <span style="color:url(x)">Nein</span></p>');
  assert.deepEqual(p.children.filter(c=>c.color).map(c=>c.color),['#3a7bd5','#12c85a']);
  assert.equal(parseRichTextDocument({version:1,blocks:[{type:'paragraph',children:[{text:'x',color:'red'}]}]}),null,'named or CSS colours are refused');
  assert.ok(parseRichTextDocument({version:1,blocks:[{type:'paragraph',children:[{text:'x',color:'#00ff00'}]}]}));
});

test('strikethrough, subtitle and alignment roundtrip', () => {
  const html='<p class="cp-subtitle cp-align-center"><s>alt</s> neu</p><h2 class="cp-align-right">Titel</h2><blockquote>Zitat</blockquote><hr>';
  const b=blocks(html);
  assert.equal(b[0].className,'cp-subtitle cp-align-center');
  assert.equal(b[0].children[0].strike,true);
  assert.equal(b[1].type,'heading2');assert.equal(b[1].className,'cp-align-right');
  assert.equal(b[2].type,'quote');assert.equal(b[3].type,'divider');
  assert.deepEqual(blocks(richTextToHtml(htmlToRichText(html))),b,'stable after a second roundtrip');
  assert.equal(blocks('<p class="evil cp-align-center">x</p>')[0].className,'cp-align-center','unknown classes are dropped');
});
