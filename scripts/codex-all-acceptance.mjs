import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareDocument,preparePDF,indexText} from '../domain/codex.ts';
import {codexBookId} from './codex-import.mjs';

const playerPublication=process.argv.includes('--players-pre-alpha');
const root='.local-work/codex-all',base=playerPublication?'http://127.0.0.1:8805':'http://127.0.0.1:8804';
const inventory=JSON.parse(readFileSync('tests/fixtures/codex-inventory.json','utf8'));
const audit=JSON.parse(readFileSync(root+'/import-audit.json','utf8'));
let checks=0;
const verify=(ok,label)=>{assert.ok(ok,label);checks++;};
const login=async email=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,password:'ChroniPlay-Demo-2036!'})});verify(r.status===200,'Synthetic login');return r.headers.get('set-cookie').split(';')[0];};
const sl=await login('command-gm@example.invalid'),player=await login('command-a@example.invalid'),gm=playerPublication?player:sl;
async function get(path,cookie){const start=performance.now(),r=await fetch(base+path,{headers:cookie?{Cookie:cookie}:{}}),body=await r.text();verify(r.headers.get('cache-control')==='private, no-store','Permission-safe cache');return {status:r.status,ms:performance.now()-start,bytes:Buffer.byteLength(body),data:JSON.parse(body)};}
const list=await get('/api/codex',gm),players=await get('/api/codex',player);
verify(list.status===200&&list.data.books.length===15&&list.data.books.every(b=>b.readerReady),'All 15 sources readable for the tested '+(playerPublication?'player':'SL'));
verify(players.data.books.length===15&&players.data.books.filter(b=>b.readerReady).length===(playerPublication?15:1),'Only explicitly configured player publication');
if(playerPublication)verify(players.data.books.every(b=>b.publicationBasis==='operator_pre_alpha')&&players.data.books.filter(b=>b.rights==='pending').length===14,'Operator decision is not a licence assertion');
verify(!JSON.stringify(list.data).includes('google.com'),'No source URLs exposed');
verify((await get('/api/codex')).status===401,'Anonymous denied');
for(const path of ['/.local-work/codex-all/inventory.json','/.local-work/codex-all/import-audit.json','/tests/fixtures/codex-inventory.json','/codex-originals/guess.pdf']){
 const r=await fetch(base+path);verify(r.status===404,'No public original/source path');
}
const reports=[];
for(const source of inventory){
 const id=codexBookId(source.sourceId),pdf=source.format==='PDF';
 const native=pdf?null:JSON.parse(readFileSync(root+'/sources/'+source.sourceId+'.json','utf8'));
 const facsimile=JSON.parse(readFileSync(root+'/prepared/'+source.sourceId+(pdf?'':'-facsimile')+'/document.json','utf8'));
 const expected=pdf?preparePDF(facsimile):[...prepareDocument(native),...preparePDF(facsimile).map(c=>({...c,id:'export-'+c.id,title:'Originalansicht · '+c.title,bookmarks:c.bookmarks?.map(b=>({...b,sectionId:'export-'+b.sectionId})),sections:c.sections.map(s=>({...s,id:'export-'+s.id}))}))];
 const toc=await get('/api/codex?book='+id,gm);
 verify(toc.status===200&&toc.data.chapters.length===expected.length,'Complete TOC '+source.title);
 assert.deepEqual(toc.data.outline.map(b=>b.title),facsimile.outlines.map(o=>o.title));checks++;
 verify(!JSON.stringify(toc.data).includes('runs'),'No whole-book bodies in TOC');
 const parts=[];
 for(const [i,c] of toc.data.chapters.entries()){
  const response=await get('/api/codex?book='+id+'&chapter='+encodeURIComponent(c.id),gm);
  assert.deepEqual(response.data.chapter.sections,expected[i].sections);checks++;
  assert.deepEqual(response.data.chapter.bookmarks,expected[i].bookmarks);checks++;
  verify(response.status===200&&response.bytes<100000,'Bounded chapter, no PDF download');
  parts.push({ms:response.ms,bytes:response.bytes});
 }
 for(const number of [...new Set([1,facsimile.pageCount])]){
  const c=expected.find(c=>c.sections.some(s=>s.source.page===number)),chapterId=id+'-'+c.id;
  const path='/api/codex?book='+id+'&chapter='+encodeURIComponent(chapterId)+'&page='+number;
  const r=await fetch(base+path,{headers:{Cookie:gm}}),body=Buffer.from(await r.arrayBuffer());
  verify(r.status===200&&r.headers.get('content-type')==='image/jpeg','Authenticated original page');
  verify(createHash('sha256').update(body).digest('hex')===facsimile.pages[number-1].imageHash,'Exact prepared original-page image');
  if(source.rights!=='own')verify((await fetch(base+path,{headers:{Cookie:player}})).status===(playerPublication?200:403),'Publisher page follows explicit player access decision');
  verify((await fetch(base+path)).status===401,'Anonymous page denied');
 }
 if(source.rights!=='own')verify((await get('/api/codex?book='+id,player)).status===(playerPublication?200:403),'Publisher reader follows explicit player access decision');
 verify((await get('/api/content-blocks?entityId='+id,gm)).data.blocks.length===0,'Generic API does not expose reader originals');
 verify((await get('/api/files?id='+encodeURIComponent('codex-originals/'+audit.find(a=>a.id===id).hash+'.pdf'),gm)).status===404,'No original download through files');
 // Choose actual distinctive source words. Search stays global, edition-labelled.
 let found=false;
 for(const s of expected.flatMap(c=>c.sections).filter(s=>indexText(s).length>80).slice(0,30)){
  const words=indexText(s).match(/[\p{L}]{4,}/gu)??[];
  const query=words.slice(2,5).join(' ');if(query.length<8)continue;
  const hits=await get('/api/codex?q='+encodeURIComponent(query)+'&edition='+source.edition,gm);
  const hit=hits.data.hits.find(h=>h.bookId===id);
  if(hit){const target=await get('/api/codex?book='+id+'&chapter='+encodeURIComponent(hit.chapterId),gm);verify(target.status===200&&target.data.chapter.sections.some(section=>section.id===hit.sectionId),'Search hit opens its exact source section');found=true;break;}
 }
 verify(found,'Each source contributes clickable indexed search results: '+source.title);
 reports.push({title:source.title,pages:facsimile.pageCount,chapters:expected.length,chapterMaxBytes:Math.max(...parts.map(p=>p.bytes)),chapterMedianMs:parts.map(p=>p.ms).sort((a,b)=>a-b)[Math.floor(parts.length/2)],tocBytes:toc.bytes,tocMs:toc.ms,ocrUnverified:facsimile.quality.ocrUnverified??[]});
}
const searchTimes=[];
for(let i=0;i<20;i++){const r=await get('/api/codex?q=Willenskraft',gm);verify(r.status===200,'FTS lookup');searchTimes.push(r.ms);}
const playerHits=await get('/api/codex?q=Willenskraft',player);verify(playerHits.data.hits.every(h=>players.data.books.some(b=>b.id===h.bookId&&b.readerReady)),'Only released books contribute player snippets');
searchTimes.sort((a,b)=>a-b);
console.log(JSON.stringify({checks,books:15,pages:reports.reduce((n,r)=>n+r.pages,0),reports,library:{ms:list.ms,bytes:list.bytes},search:{medianMs:searchTimes[10],p95Ms:searchTimes[18]},productionUsed:false,publisherPlayerRelease:playerPublication,licencesConfirmed:false},null,2));
