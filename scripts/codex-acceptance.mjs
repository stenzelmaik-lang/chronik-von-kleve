import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareDocument} from '../domain/codex.ts';

// Exact local destination only: neither credentials nor source text go to production.
const base='http://127.0.0.1:8804',sourcePath=process.argv[2]??'.local-work/codex-v1/source.json';
const raw=readFileSync(sourcePath,'utf8'),doc=JSON.parse(raw),expected=prepareDocument(doc);
const hash=createHash('sha256').update(raw).digest('hex');
const login=async email=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
const gm=await login('command-gm@example.invalid'),player=await login('command-a@example.invalid');
let checks=0;
const verify=(v)=>{assert.ok(v);checks++;};
async function request(path,cookie){
 const start=performance.now(),r=await fetch(base+path,{headers:cookie?{Cookie:cookie}:{}}),text=await r.text();
 verify(r.headers.get('cache-control')==='private, no-store');
 return {status:r.status,bytes:Buffer.byteLength(text),ms:performance.now()-start,data:JSON.parse(text)};
}
verify((await request('/api/codex')).status===401);
const list=await request('/api/codex',player);verify(list.status===200&&list.data.books.length===15);
verify(list.data.books.filter(b=>b.readerReady).length===1);
verify(!JSON.stringify(list.data).includes('google.com')&&!JSON.stringify(list.data).includes(doc.documentId));
const book=list.data.books.find(b=>b.readerReady);verify(book.hash===hash);
const toc=await request('/api/codex?book='+book.id,player);verify(toc.status===200&&toc.data.chapters.length===6);
const chapterMeasurements=[];
for(const [i,c] of toc.data.chapters.entries()){
 const result=await request('/api/codex?book='+book.id+'&chapter='+c.id,player);
 verify(result.status===200);
 assert.deepEqual(result.data.chapter.sections,expected[i].sections);checks++;
 chapterMeasurements.push({title:c.title,ms:Number(result.ms.toFixed(1)),bytes:result.bytes});
}
const table=expected.flatMap(c=>c.sections).find(s=>s.kind==='table');verify(table.rows.length===13&&table.rows.every(r=>r.length===2));
const blocked=list.data.books.find(b=>b.edition==='V5');
verify((await request('/api/codex?book='+blocked.id,gm)).status===403);
verify((await request('/api/content-blocks?entityId='+book.id,gm)).data.blocks.length===0);
verify((await request('/api/files?id='+encodeURIComponent('codex-originals/'+hash+'.json'),player)).status===404);
for(const path of ['/codex-originals/'+hash+'.json','/.local-work/codex-v1/source.json','/tests/fixtures/codex-inventory.json']){
 const response=await fetch(base+path),text=await response.text();
 verify(response.status===404&&!text.includes(doc.documentId));
}
const measurements=[];
for(let i=0;i<12;i++){
 const result=await request('/api/codex?q=Willenskraft',player);verify(result.status===200&&result.data.hits.length>0);
 verify(result.data.hits.every(h=>h.bookId===book.id&&h.edition==='HOUSE'&&h.source.tab==='t.0'));
 measurements.push(result.ms);
}
verify((await request('/api/codex?q=Willenskraft&edition=V5',player)).data.hits.length===0);
const sorted=measurements.slice().sort((a,b)=>a-b);
console.log(JSON.stringify({checks,sourceHash:hash,books:15,fullyImported:1,chapters:6,sections:expected.flatMap(c=>c.sections).length,table:{rows:13,columns:2,cells:26},library:{ms:Number(list.ms.toFixed(1)),bytes:list.bytes},toc:{ms:Number(toc.ms.toFixed(1)),bytes:toc.bytes},chapterMeasurements,search:{requests:12,coldMs:Number(measurements[0].toFixed(1)),medianMs:Number(sorted[6].toFixed(1)),p95Ms:Number(sorted[11].toFixed(1))},cache:'private, no-store',originals:'private R2, no files entry; guessed file ID denied',productionUsed:false},null,2));
