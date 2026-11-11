import test from 'node:test';
import assert from 'node:assert/strict';
import { castMvpVote, tallyMvpVotes, closeMvpVote } from '../domain/mvp-vote.ts';
const poll = { version:1,status:'open',votes:[],openedAt:'t',openedBy:'gm' };
const eligible = ['alice','bob','carol'];
test('attendees can vote once for another attendee and revise before closing', () => {
  const a=castMvpVote(poll,'alice','bob',eligible,'t1');
  assert.equal(a.votes.length,1);
  assert.equal(a.version,2);
  const repeat=castMvpVote(a,'alice','bob',eligible,'t2');
  assert.deepEqual(repeat,a);
  const revised=castMvpVote(a,'alice','carol',eligible,'t3');
  assert.deepEqual(revised.votes.map(x=>[x.voterId,x.nomineeId]),[['alice','carol']]);
  assert.equal(revised.version,3);
});
test('no self-vote, outsider vote or nominating outsider',()=>{
  for (const args of [['alice','alice'],['outsider','bob'],['alice','outsider']])
    assert.throws(()=>castMvpVote(poll,args[0],args[1],eligible,'t1'));
});
test('a closed MVP ballot cannot be edited and ties never select a winner automatically',()=>{
  let a=castMvpVote(poll,'alice','bob',eligible,'t1');
  a=castMvpVote(a,'carol','bob',eligible,'t2');
  const closed=closeMvpVote(a,'gm','t3');
  assert.deepEqual(tallyMvpVotes(closed.votes), [{nomineeId:'bob',votes:2}]);
  assert.equal(closed.status,'closed');
  assert.throws(()=>castMvpVote(closed,'bob','alice',eligible,'t4'));
  const tie=tallyMvpVotes([{voterId:'alice',nomineeId:'bob',at:'t'},{voterId:'bob',nomineeId:'alice',at:'t'}]);
  assert.equal(tie[0].votes,tie[1].votes);
});
