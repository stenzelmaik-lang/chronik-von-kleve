import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {boardElement,tableSignal,tablePeerId} from '../domain/live-table.ts';

test('production screen capture stays gated independently of whiteboard actions',()=>{
  const source=readFileSync(new URL('../app/api/live-table/route.ts',import.meta.url),'utf8');
  assert.match(source,/AUTH_ACCESS_ENVIRONMENT === 'closed-alpha-production'/);
  assert.match(source,/if\(d\.action==='startScreen'\)\{\s*iceConfiguration\(\);/);
});
test('whiteboard accepts bounded points and text without client identity',()=>{
  const id=randomUUID();const result=boardElement({id,color:'#abcdef',points:[[10.4,20.6]],text:' Test ',memberId:'forged'});
  assert.deepEqual(result,{id,color:'#abcdef',points:[[10,21]],text:'Test'});assert.equal(result.memberId,undefined);
});
test('whiteboard rejects unbounded coordinates, paths and HTML colors',()=>{
  const valid={id:randomUUID(),color:'#abcdef',points:[[10,20]]};
  for(const value of [{...valid,points:[[1001,0]]},{...valid,points:[[NaN,0]]},{...valid,points:Array(129).fill([1,1])},{...valid,color:'url(example)'},{...valid,text:'x'.repeat(501)}])assert.throws(()=>boardElement(value));
  assert.equal(tablePeerId('../foreign'),false);
});
test('screen signaling is limited to descriptions and bounded ICE, no audio',()=>{
  assert.equal(tableSignal({type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'}).type,'offer');
  assert.equal(tableSignal({type:'candidate',candidate:{candidate:'candidate:test',sdpMid:'0',sdpMLineIndex:0}}).type,'candidate');
  for(const value of [{type:'audio',sdp:'v=0'},{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'},{type:'answer',sdp:'x'.repeat(20001)},{type:'candidate',candidate:{candidate:'x'.repeat(2001),sdpMid:'0',sdpMLineIndex:0}},{type:'candidate',candidate:{candidate:'candidate:test',sdpMid:'x'.repeat(65),sdpMLineIndex:0}}])assert.throws(()=>tableSignal(value));
});
