import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canFormatNPCText} from '../domain/npc-rich-text.ts';
import {htmlToRichText,readRichText,richTextToPlainText,richTextToHtml} from '../domain/location-rich-text.ts';

test('NPC text retains paragraphs, empty paragraphs, headings, marks and lists through editor roundtrip',()=>{
 const value=htmlToRichText('<h2>Hintergrund</h2><p><strong>Erster Absatz</strong></p><p><br></p><p>Zweiter<br>Zeile</p><ul><li>Hinweis</li></ul>');
 const next=htmlToRichText(richTextToHtml(value));
 assert.equal(canFormatNPCText(value),true);
 assert.deepEqual(readRichText(next).blocks.map(b=>b.type),['heading2','paragraph','paragraph','paragraph','bulletList']);
 assert.equal(readRichText(next).blocks[1].children[0].bold,true);
 assert.equal(readRichText(next).blocks[2].children.length,0);
 assert.equal(richTextToPlainText(next),'Hintergrund\nErster Absatz\n\nZweiter\nZeile\nHinweis');
 assert.equal(canFormatNPCText('Erster\n\nZweiter'),true);
});
test('Oversized existing NPC text remains on the non-destructive plain-text editor path',()=>{
 assert.equal(canFormatNPCText('x'.repeat(70000)),false);
 assert.equal(canFormatNPCText(Array(130).fill('Absatz').join('\n')),false);
});
test('NPC editor reuses safe rich editor; reading view explicitly preserves whitespace and list markers',()=>{
 const editor=readFileSync('app/spielbereich/modules/npc-editor.tsx','utf8');
 const css=readFileSync('app/spielbereich/modules/npc-dossier.module.css','utf8');
 assert.match(editor,/<RichTextEditor value=\{b.content\}/);
 assert.match(editor,/<div inert=\{busy\}>/);
 assert.match(css,/\.textBlock p \{[^}]*white-space:pre-wrap;[^}]*min-height:1.8em/);
 assert.match(css,/\.textBlock ul \{ list-style:disc/);
 assert.match(css,/\.textBlock ol \{ list-style:decimal/);
});
