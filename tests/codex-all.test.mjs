import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePDF,prepareDocument,sectionText,sourceLabel,boundedChapters} from '../domain/codex.ts';
import {importCodexSources} from '../scripts/codex-import.mjs';

test('PDF pages, exact text and source labels survive bounded chapter import with original bookmarks',()=>{
 const pages=Array.from({length:30},(_,i)=>({page:i+1,label:String(i-1),text:'Original\nText\t7–9\n'.repeat(600)}));
 const c=preparePDF({pageCount:30,pages,outlines:[{level:1,title:'Unverändertes Kapitel',page:3},{level:2,title:'Unterabschnitt',page:9}]});
 assert.deepEqual(c.flatMap(c=>c.sections.map(s=>sectionText(s))),pages.map(p=>p.text));
 assert.equal(c.flatMap(c=>c.sections).length,30);
 assert.ok(c.every(c=>JSON.stringify(c).length<=60000));
 assert.ok(c.some(c=>c.title==='Unverändertes Kapitel'));
 assert.equal(c.flatMap(c=>c.bookmarks).length,2);
 assert.equal(sourceLabel(c[0].sections[0].source),'PDF-Seite 1 · Originalzählung -1');
 assert.deepEqual(preparePDF({pageCount:30,pages,outlines:[]}).flatMap(c=>c.sections).map(s=>s.source.page),pages.map(p=>p.page));
 assert.throws(()=>preparePDF({pageCount:31,pages,outlines:[]}),/unvollständig/);
});
test('Oversize sections fail explicitly instead of losing source text',()=>{
 assert.throws(()=>boundedChapters([{id:'c',title:'c',sections:[{id:'s',kind:'paragraph',level:0,runs:[{text:'X'.repeat(90000),bold:false,italic:false}],rows:[],source:{tab:'t',start:1,end:90001}}]}]),/keine automatische Kürzung/);
});
test('PDF bookmark source order survives cross-references to earlier pages',()=>{
 const outlines=[{title:'Late chapter',level:1,page:3},{title:'Early cross-reference',level:2,page:1}];
 const chapters=preparePDF({pageCount:3,pages:[1,2,3].map(page=>({page,label:String(page),text:'source'})),outlines});
 assert.deepEqual(chapters.flatMap(c=>c.bookmarks).sort((a,b)=>a.order-b.order).map(b=>b.title),outlines.map(o=>o.title));
});
test('Native unsupported inline objects fail explicitly and section separators survive',()=>{
 const doc={documentId:'test',title:'test',tabs:[{tabId:'t',title:'tab',body:{content:[{startIndex:1,endIndex:5,paragraph:{elements:[{textRun:{content:'A\n'}},{horizontalRule:{}}]}}]}}]};
 assert.deepEqual(prepareDocument(doc)[0].sections[0].separators,['horizontalRule']);
 doc.tabs[0].body.content[0].paragraph.elements.push({inlineObjectElement:{inlineObjectId:'secret'}});
 assert.throws(()=>prepareDocument(doc),/Nicht unterstütztes natives Element/);
});
test('Native heading hierarchy chooses actual document headings instead of one enormous chapter',()=>{
 const p=(text,index,level)=>({startIndex:index,endIndex:index+text.length,paragraph:{paragraphStyle:{namedStyleType:'HEADING_'+level},elements:[{textRun:{content:text}}]}});
 const c=prepareDocument({documentId:'test',title:'test',tabs:[{tabId:'a',title:'a',body:{content:[p('Teil 1\n',1,3),p('Unterpunkt\n',9,4),p('Teil 2\n',20,3)]}},{tabId:'b',title:'b',body:{content:[p('Tab B\n',1,1)]}}]});
 assert.equal(c.length,3);assert.equal(c[0].title,'Teil 1');assert.equal(c[1].title,'Teil 2');assert.ok(c[2].sections[0].source.tab==='b');
});
test('Importer refuses remote destinations before touching sources or database',async()=>{
 await assert.rejects(importCodexSources({base:'https://chroniplay.example',root:'not-read',db:{},bucket:{}}),/local-only/);
});
