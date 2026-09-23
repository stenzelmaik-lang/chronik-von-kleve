import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {sourcePointer} from '../domain/recovery.ts';
const pkg=JSON.parse(readFileSync('server/recovery-package.json','utf8')),m=pkg.manifest;
const hash=b=>createHash('sha256').update(b).digest('hex');
test('all indexed originals survive byte-for-byte; all claims resolve',()=>{
 const originals=new Map();
 for(const s of m.sources){if(!s.packagePath)continue;const bytes=readFileSync('recovery/inputs/'+s.packagePath);assert.equal(hash(bytes),s.sha256);assert.deepEqual(gunzipSync(Buffer.from(pkg.blobs[s.sha256],'base64')),bytes);originals.set(s.id,JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));}
 assert.equal(new Set(m.records.map(r=>r.id)).size,m.records.length);
 for(const r of m.records){const v=sourcePointer(originals.get(r.sourceId),r.pointer);assert.notEqual(v,undefined);assert.equal(r.confidentiality,'GM_ONLY');assert.ok(r.decision);}
 for(const s of m.sources.filter(s=>s.packagePath))assert.equal(m.records.filter(r=>r.sourceId===s.id).length,s.recordCount);
});
test('binding minimum coverage and original ID collision',()=>{
 const source=id=>m.sources.find(s=>s.registryId===id);
 for(const [id,n] of [['legacy-static-places-2025-11-06',10],['legacy-chronik-diary-2025-11-06',22],['legacy-encounters-2025-11-06',45],['legacy-news-2025-11-08',2],['legacy-events-2025-11-06',1],['legacy-archive-index-2025-11-06',7]])assert.equal(source(id).recordCount,n,id);
 const merchants=m.records.filter(r=>r.sourceId===source('legacy-merchants-2025-11-10').id&&r.pointer.includes('/items/'));assert.equal(merchants.length,68);
 const news=m.records.filter(r=>r.sourceId===source('legacy-news-2025-11-08').id);assert.equal(new Set(news.map(r=>r.entityId)).size,2);assert.equal(news[0].legacyId,news[1].legacyId);
 for(const [role,type,n] of [['db-1','NPC',14],['db-2','PLACE',11]]){const s=m.sources.find(s=>s.documentRole===role);assert.equal(m.records.filter(r=>r.sourceId===s.id&&r.entityType===type).length,n);}
 const baseline=m.sources.find(s=>s.category==='BASELINE');assert.equal(m.records.filter(r=>r.sourceId===baseline.id).length,67);
 for(const name of ['boons.json','ledger.json','threads.json'])assert.ok(m.sources.some(s=>s.name===name&&s.decision==='CHECKED_EMPTY_NO_RECORDS'));
 assert.equal(m.missingRawTables.find(t=>t.table==='characters').documentedCount,7);
 assert.ok(m.records.some(r=>r.recoveryStatus==='UNPLAYED_PREP'));
 assert.ok(m.sources.filter(s=>s.name==='users.json').every(s=>s.packagePath===null));
});
