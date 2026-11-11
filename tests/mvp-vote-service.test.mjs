import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {openMvpVote,submitMvpVote,finishMvpVote,viewMvpVote,listOpenMvpVotes,MvpVoteError} from '../server/mvp-vote-service.ts';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE played_sessions(id TEXT,campaign_id TEXT,title TEXT,played_on TEXT);
 CREATE TABLE xp_settlements(id TEXT,campaign_id TEXT,played_session_id TEXT);
 CREATE TABLE xp_settlement_participants(settlement_id TEXT,character_id TEXT,attended INT);
 CREATE TABLE records(id TEXT,campaign_id TEXT,owner_id TEXT,kind TEXT);
 CREATE TABLE members(id TEXT,name TEXT,status TEXT);
 CREATE TABLE campaign_memberships(campaign_id TEXT,user_id TEXT,status TEXT);
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 INSERT INTO played_sessions VALUES('session','campaign','Runde','2026-11-08');
 INSERT INTO xp_settlements VALUES('receipt','campaign','session');
 INSERT INTO members VALUES('alice','Alice','active'),('bob','Bob','active'),('carol','Carol','active');
 INSERT INTO records VALUES('a','campaign','alice','charaktere'),('b','campaign','bob','charaktere'),('c','campaign','carol','charaktere');
 INSERT INTO xp_settlement_participants VALUES('receipt','a',1),('receipt','b',1),('receipt','c',0);`);
 class Statement {
   constructor(q,bindings=[]){this.q=q;this.bindings=bindings;}
   bind(...args){return new Statement(this.q,args);}
   async first(){await null;return sql.prepare(this.q).get(...this.bindings)??null;}
   async all(){await null;return {results:sql.prepare(this.q).all(...this.bindings)};}
   async run(){await null;return {meta:{changes:Number(sql.prepare(this.q).run(...this.bindings).changes)}};}
 }
 return {sql,db:{prepare:q=>new Statement(q)}};
}
const args=['campaign','session'];
test('only confirmed attendance determines MVP candidates',async()=>{
 const {db}=fixture();
 const opened=await openMvpVote(db,...args,'gm','now');
 assert.deepEqual(opened.candidates.map(c=>c.id),['alice','bob']);
 assert.equal(opened.status,'open');
 await assert.rejects(submitMvpVote(db,...args,'carol','alice','t'),e=>e instanceof MvpVoteError&&e.status===409);
 await assert.rejects(submitMvpVote(db,...args,'alice','alice','t'),e=>e instanceof MvpVoteError&&e.status===409);
});
test('same voter replaces rather than duplicates their ballot, closing prevents changes',async()=>{
 const {db}=fixture();
 await openMvpVote(db,...args,'gm','t');
 await submitMvpVote(db,...args,'alice','bob','t');
 const again=await submitMvpVote(db,...args,'alice','bob','t2');
 assert.equal(again.totalVotes,1);
 const result=await finishMvpVote(db,...args,'gm','t3');
 assert.deepEqual(result.results,[{nomineeId:'bob',votes:1}]);
 await assert.rejects(submitMvpVote(db,...args,'bob','alice','t4'));
 assert.equal((await viewMvpVote(db,...args,'alice',false)).status,'closed');
});
test('parallel votes do not overwrite one another',async()=>{
 const {db}=fixture();
 await openMvpVote(db,...args,'gm','t');
 await Promise.all([submitMvpVote(db,...args,'alice','bob','t'),submitMvpVote(db,...args,'bob','alice','t')]);
 assert.equal((await finishMvpVote(db,...args,'gm','t2')).totalVotes,2);
});
test('campaign isolation blocks foreign session',async()=>{
 const {db}=fixture();
 await assert.rejects(openMvpVote(db,'foreign','session','gm','t'),e=>e instanceof MvpVoteError&&e.status===404);
});
test('open MVP poll discovery returns only elections for an actual participant',async()=>{
 const {db}=fixture();
 assert.deepEqual(await listOpenMvpVotes(db,'campaign','alice'),[]);
 await openMvpVote(db,...args,'gm','t');
 assert.deepEqual((await listOpenMvpVotes(db,'campaign','alice')).map(e=>e.id),['session']);
 assert.deepEqual(await listOpenMvpVotes(db,'campaign','carol'),[]);
 await finishMvpVote(db,...args,'gm','t2');
 assert.deepEqual(await listOpenMvpVotes(db,'campaign','alice'),[]);
});
