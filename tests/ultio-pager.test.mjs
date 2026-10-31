import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {emptyStage,changeStageObjects,stageCommandSchema} from '../domain/live-stage.ts';
import {emptyScene,sceneDocumentSchema,sceneElementSchema,emptyScenePager} from '../domain/story-scene.ts';
import {pagerDeviceMessages,pagerUnread,pagerKeyOf,pressPagerKey,pagerArrivals,settlePagerDevice,initialPagerDevice,pagerBaseMenu} from '../domain/ultio-pager.ts';
// ULTIO pager R-03: scene preparation, device logic and the live contract it builds on.
const a={id:'a',name:'Player A',gm:false},b={id:'b',name:'Player B',gm:false},gm={id:'sl',name:'SL',gm:true};
const id='0b6f2a52-4e1c-4f53-9a51-2f6d1f9e7c10';
const element={id,kind:'pager',title:'Südtor',text:'',referenceId:'',fileId:'',pager:{sender:'Schäfer',text:'In 10 Minuten am Südtor. Komm allein.',priority:'hoch',recipientIds:['a']}};

test('a scene prepares pager messages as material; older scenes stay valid',()=>{
 const old={...emptyScene(),elements:[{id:'4f0d8e0a-6b7c-4d2e-8f3a-1b2c3d4e5f60',kind:'text',title:'Alt',text:'',referenceId:'',fileId:''}]};
 assert.ok(sceneDocumentSchema.safeParse(old).success,'Scenes without pager data parse unchanged');
 const parsed=sceneDocumentSchema.parse({...emptyScene(),elements:[element]});
 assert.deepEqual(parsed.elements[0].pager,element.pager);
 assert.deepEqual(sceneElementSchema.parse({...element,pager:{}}).pager,emptyScenePager(),'Defaults fill an empty draft');
 assert.equal(sceneElementSchema.parse({...element,pager:undefined}).pager,undefined,'A pager element without data is an empty draft');
});

test('pager elements are bounded and only pager elements carry pager data',()=>{
 const bad=[
  {...element,title:'x'.repeat(81)},
  {...element,pager:{...element.pager,text:'x'.repeat(281)}},
  {...element,pager:{...element.pager,priority:'panik'}},
  {...element,pager:{...element.pager,recipientIds:['a','a']}},
  {...element,pager:{...element.pager,extra:true}},
  {...element,fileId:'file-1'},
  {...element,kind:'text'},
 ];
 for(const e of bad)assert.equal(sceneElementSchema.safeParse(e).success,false,JSON.stringify(e).slice(0,90));
});

test('playing a prepared pager: its element id is the message id, sent once; withdraw allows a replay',()=>{
 const play={action:'pager',id,origin:'vorbereitet',text:element.pager.text,title:element.title,sender:'Schäfer',priority:'hoch',recipients:['a']};
 assert.ok(stageCommandSchema.safeParse(play).success);
 let s=changeStageObjects(emptyStage(),gm,play);
 assert.equal(s.pagers[0].id,id);assert.equal(s.pagers[0].origin,'vorbereitet');
 assert.throws(()=>changeStageObjects(s,gm,play),e=>e.status===409,'Same id: not sent twice');
 assert.throws(()=>changeStageObjects(emptyStage(),gm,{...play,id:undefined}),e=>e.status===400,'Prepared messages need their id');
 assert.throws(()=>changeStageObjects(emptyStage(),a,play),e=>e.status===403,'Only the GM sends');
 assert.throws(()=>changeStageObjects(s,b,{action:'pagerAck',id}),e=>e.status===404,'B cannot confirm a message for A');
 s=changeStageObjects(s,gm,{action:'pagerWithdraw',id});
 s=changeStageObjects(s,gm,play);assert.equal(s.pagers.length,1);
});

const pagers=[
 {id:'p1',text:'Erste',at:'2026-10-31T20:00:00.000Z',sender:'Schäfer'},
 {id:'p2',text:'Zweite',at:'2026-10-31T20:05:00.000Z',title:'Alarm',priority:'hoch'},
 {id:'p3',text:'Dritte',at:'2026-10-31T20:10:00.000Z',acknowledged:true},
];

test('device messages: newest first, same id once, server acknowledgement wins',()=>{
 const m=pagerDeviceMessages([...pagers,{...pagers[0],text:'Wiederholung'}],['p1']);
 assert.deepEqual(m.map(x=>x.id),['p3','p2','p1']);
 assert.equal(m.find(x=>x.id==='p1').text,'Erste','A replayed id never replaces or duplicates');
 assert.equal(m[0].opened,true,'Acknowledged counts as opened');assert.equal(m[1].urgent,true);
 assert.equal(pagerUnread(m),1,'Only p2 is unopened');
 assert.equal(pagerDeviceMessages(pagers,[],['p2']).find(x=>x.id==='p2').acknowledged,true,'Local acknowledgement shows at once');
});

test('the five keys: menu cycles, OK opens then acknowledges, back returns and finally folds',()=>{
 const m=pagerDeviceMessages(pagers);
 let st=initialPagerDevice();
 st=pressPagerKey(st,'menu',m).state;assert.equal(st.view,'inbox');
 st=pressPagerKey(st,'menu',m).state;assert.equal(st.view,'status');
 st=pressPagerKey(st,'menu',m).state;assert.equal(st.view,'home');
 assert.equal(pressPagerKey(st,'menu',m,[...pagerBaseMenu,'karte']).state.view,'inbox','Registered menu views join the cycle');
 st=pressPagerKey(st,'ok',m).state;assert.equal(st.view,'inbox');
 st=pressPagerKey(st,'down',m).state;assert.equal(st.inboxIndex,1);
 st=pressPagerKey(pressPagerKey(st,'down',m).state,'down',m).state;assert.equal(st.inboxIndex,2,'Selection stays on a real message');
 st=pressPagerKey(st,'up',m).state;
 let r=pressPagerKey(st,'ok',m);assert.equal(r.state.view,'message');assert.deepEqual(r.effect,{type:'opened',id:'p2'});st=r.state;
 assert.deepEqual(pressPagerKey(st,'down',m).effect,{type:'scroll',step:1});
 assert.deepEqual(pressPagerKey(st,'ok',m).effect,{type:'acknowledge',id:'p2'});
 assert.equal(pressPagerKey({...st,selectedId:'p3'},'ok',m).effect,undefined,'Acknowledged once only');
 st=pressPagerKey(st,'back',m).state;assert.equal(st.view,'inbox');
 st=pressPagerKey(st,'back',m).state;assert.equal(st.view,'home');
 assert.deepEqual(pressPagerKey(st,'back',m).effect,{type:'collapse'});
 assert.equal(pressPagerKey({...initialPagerDevice(),view:'inbox'},'ok',[]).effect,undefined,'Empty inbox: nothing to open');
});

test('keyboard, arrivals and withdrawn messages',()=>{
 assert.deepEqual(['ArrowUp','ArrowDown','Enter','Escape','m','M','x'].map(pagerKeyOf),['up','down','ok','back','menu','menu',undefined]);
 const m=pagerDeviceMessages(pagers);
 assert.deepEqual(pagerArrivals(null,m),[],'After a reload nothing rings again');
 assert.deepEqual(pagerArrivals(['p1','p3'],m).map(x=>x.id),['p2']);
 assert.deepEqual(settlePagerDevice({view:'message',inboxIndex:2,selectedId:'gone'},m.slice(0,1)),{view:'inbox',inboxIndex:0,selectedId:null});
});

test('assets: the delivered housing is used as webp, the reference picture and demo scripts are not shipped',()=>{
 const webp=readFileSync(new URL('../public/spieltisch/pager/ultio-shell.webp',import.meta.url));
 assert.equal(webp.toString('ascii',0,4)+webp.toString('ascii',8,12),'RIFFWEBP');
 assert.equal(1+webp.readUIntLE(24,3),1448);assert.equal(1+webp.readUIntLE(27,3),1086,'Aspect ratio 1448:1086 as in the CSS');
 for(const f of ['ping-normal.wav','alarm-urgent.wav'])assert.ok(existsSync(new URL('../public/spieltisch/pager/'+f,import.meta.url)));
 for(const f of ['shell-ultio-reference.png','pager-assistant.js','demo-offline.html'])assert.equal(existsSync(new URL('../public/spieltisch/pager/'+f,import.meta.url)),false,f);
 const css=readFileSync(new URL('../app/spielbereich/modules/spieltisch/ultio-pager.module.css',import.meta.url),'utf8');
 assert.match(css,/aspect-ratio:1448\/1086/);assert.match(css,/prefers-reduced-motion/);
});
