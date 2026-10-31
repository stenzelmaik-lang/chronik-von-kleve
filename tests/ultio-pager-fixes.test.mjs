import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyStage,changeStageObjects,stageSchema,stageCommandSchema} from '../domain/live-stage.ts';
import {pagerDeviceMessages,pagerUnread,pagerRing,pagerReadsToSync} from '../domain/ultio-pager.ts';
import {pagerSoundGain,pagerRingSlot,pagerRingSeconds} from '../app/spielbereich/modules/spieltisch/pager-sound.ts';
// Regressions for the three live acceptance defects of the ULTIO pager (docs/spieltisch-2-0/ULTIO-Pager-Fehlerbericht.md).
const a={id:'a',name:'Player A',gm:false},b={id:'b',name:'Player B',gm:false},gm={id:'sl',name:'SL',gm:true};

// --- 2. Read state on the server -------------------------------------------------------------------------------------
test('read receipt: only the recipient, once, monotonic; acknowledging implies reading',()=>{
 let s=changeStageObjects(emptyStage(),gm,{action:'pager',text:'Nur A',recipients:['a']},undefined,undefined,undefined,'t0');
 s=changeStageObjects(s,gm,{action:'pager',text:'Alle',recipients:null},undefined,undefined,undefined,'t0');
 const [onlyA,all]=s.pagers.map(p=>p.id);
 assert.ok(stageCommandSchema.safeParse({action:'pagerRead',id:onlyA}).success);
 assert.throws(()=>changeStageObjects(s,b,{action:'pagerRead',id:onlyA}),e=>e.status===404,'B cannot mark a message for A');
 assert.throws(()=>changeStageObjects(s,gm,{action:'pagerRead',id:onlyA}),e=>e.status===404,'The GM does not read for players');
 assert.throws(()=>changeStageObjects(s,a,{action:'pagerRead',id:'erfunden'}),e=>e.status===404,'Only real ids');
 s=changeStageObjects(s,a,{action:'pagerRead',id:onlyA},undefined,undefined,undefined,'t1');
 assert.deepEqual(s.pagers[0].reads,[{id:'a',at:'t1'}]);
 assert.equal(changeStageObjects(s,a,{action:'pagerRead',id:onlyA},undefined,undefined,undefined,'t2'),s,'A repeated read changes nothing');
 s=changeStageObjects(s,a,{action:'pagerAck',id:onlyA},undefined,undefined,undefined,'t3');
 assert.deepEqual(s.pagers[0].reads,[{id:'a',at:'t1'}],'A late acknowledgement keeps the first read');
 assert.equal(changeStageObjects(s,a,{action:'pagerRead',id:onlyA},undefined,undefined,undefined,'t4'),s,'A late read after the acknowledgement changes nothing');
 s=changeStageObjects(s,b,{action:'pagerAck',id:all},undefined,undefined,undefined,'t5');
 assert.deepEqual(s.pagers[1].reads,[{id:'b',at:'t5'}],'Acknowledging without opening first also counts as read');
 assert.equal(s.pagers[1].reads.some(x=>x.id==='a'),false,'Other recipients are never marked along');
});

test('stages without read receipts stay valid; the field is bounded',()=>{
 const old={format:1,version:3,objects:[],pagers:[{id:'p',text:'alt',at:'t',recipients:null,acks:[{id:'a',at:'t'}]}]};
 assert.ok(stageSchema.safeParse(old).success);
 assert.equal(stageSchema.safeParse({...old,pagers:[{...old.pagers[0],reads:Array.from({length:31},(_,i)=>({id:'p'+i,at:'t'}))}]}).success,false);
});

test('client read state: server read, local opening and acknowledgement all count; nothing resets it',()=>{
 const pagers=[{id:'p1',text:'x',at:'2026-10-31T20:00:00Z',read:true},{id:'p2',text:'y',at:'2026-10-31T20:01:00Z'},{id:'p3',text:'z',at:'2026-10-31T20:02:00Z',acknowledged:true}];
 assert.equal(pagerUnread(pagerDeviceMessages(pagers)),1,'Only p2 is unread');
 assert.equal(pagerUnread(pagerDeviceMessages(pagers,['p2'])),0,'Opening here counts at once');
 const late=pagers.map(p=>({...p,read:false}));
 assert.equal(pagerUnread(pagerDeviceMessages(late,['p1','p2'])),0,'A late snapshot without the read flag does not reset local reads');
 assert.deepEqual(pagerReadsToSync(late,['p1','p2'],new Set()),['p1','p2'],'Missing receipts are sent again');
 assert.deepEqual(pagerReadsToSync(late,['p1','p2'],new Set(['p1'])),['p2'],'A receipt in flight is not sent twice');
 assert.deepEqual(pagerReadsToSync(pagers,['p1','p3'],new Set()),[],'Server already has them');
});

// --- 1. Sound ------------------------------------------------------------------------------------------------------
const m=(id,urgent=false)=>({id,text:id,at:'2026-10-31T20:00:00Z',title:'',sender:'',urgent,acknowledged:false,opened:false});
test('rings: never on reload, never twice for one id, one ring per sync, alarm for urgent',()=>{
 const first=pagerRing(new Set(['p1','p2']),[m('p1'),m('p2')]);
 assert.equal(first.kind,null,'Reload: the current ids are already heard');
 const two=pagerRing(first.heard,[m('p1'),m('p2'),m('p3'),m('p4',true)]);
 assert.deepEqual(two.fresh.map(x=>x.id),['p3','p4']);assert.equal(two.kind,'alarm','Several new ids: one ring, urgent wins');
 const stale=pagerRing(two.heard,[m('p1'),m('p2')]);assert.equal(stale.kind,null,'An older snapshot rings nothing');
 const back=pagerRing(stale.heard,[m('p1'),m('p2'),m('p3'),m('p4',true)]);assert.equal(back.kind,null,'The fresh snapshot after it does not ring again');
 assert.equal(pagerRing(back.heard,[m('p3'),m('p3')]).kind,null,'A duplicate event is no new message');
});

function wav(file){
 const buf=readFileSync(new URL('../public/spieltisch/pager/'+file,import.meta.url));let off=12,data;
 while(off<buf.length){const id=buf.toString('ascii',off,off+4),len=buf.readUInt32LE(off+4);if(id==='data'){data=buf.subarray(off+8,off+8+len);break;}off+=8+len;}
 let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));return {peak:peak/32768,seconds:data.length/2/buf.readUInt32LE(24)};
}
test('the pager tone is short and clearly audible without clipping',()=>{
 for(const f of ['ping-normal.wav','alarm-urgent.wav']){
  const {peak,seconds}=wav(f),db=20*Math.log10(peak*pagerSoundGain);
  assert.ok(seconds<=.6,f+' is a short beep');
  assert.ok(db>=-12&&db<=-3,f+' plays at '+db.toFixed(1)+' dBFS peak (audible, below clipping)');
  assert.ok(seconds<=pagerRingSeconds[f.startsWith('ping')?'ping':'alarm'],f+' fits its reserved slot');
 }
});

test('rings never overlap: a ping during a sound is dropped, an alarm follows directly, no pile-up',()=>{
 assert.equal(pagerRingSlot(10,9.5,'ping'),10,'Free: now');
 assert.equal(pagerRingSlot(10,10.3,'ping'),null,'Ping during a ring: dropped');
 assert.equal(pagerRingSlot(10,10.3,'alarm'),10.3,'Alarm during a ping: right after it');
 assert.equal(pagerRingSlot(10,11.5,'alarm'),null,'No backlog beyond a second');
});

// --- 3. Keys on the housing ----------------------------------------------------------------------------------------
// Key caps measured on public/spieltisch/pager/ultio-shell.webp (1448 x 1086), see the error report.
const caps={menu:[170,358],up:[396,580],down:[612,828],ok:[858,1046],back:[1084,1268]},capY=[746,888];
test('every key hit area lies on its key cap, inside it, without covering the seams',()=>{
 const css=readFileSync(new URL('../app/spielbereich/modules/spieltisch/ultio-pager.module.css',import.meta.url),'utf8');
 const rule=/\.key\{[^}]*\}/.exec(css)[0],num=(re,src)=>Number(re.exec(src)[1]);
 const top=num(/top:([\d.]+)%/,rule)/100*1086,w=num(/width:([\d.]+)%/,rule)/100*1448,h=num(/height:([\d.]+)%/,rule)/100*1086;
 assert.match(rule,/translate\(-50%,-50%\)/,'Positions are centres');
 for(const [key,[x0,x1]] of Object.entries(caps)){
  const cx=num(new RegExp('\\.key\\[data-key='+key+'\\]\\{left:([\\d.]+)%'),css)/100*1448;
  assert.ok(Math.abs(cx-(x0+x1)/2)<=4,key+': centre '+cx.toFixed(0)+' on the cap centre '+(x0+x1)/2);
  assert.ok(cx-w/2>=x0&&cx+w/2<=x1,key+': hit area stays inside the cap horizontally');
 }
 assert.ok(Math.abs(top-(capY[0]+capY[1])/2)<=4&&top-h/2>=capY[0]&&top+h/2<=capY[1],'Hit areas stay inside the caps vertically');
});
