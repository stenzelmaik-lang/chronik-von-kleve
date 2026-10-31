import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// ULTIO pager on the table (live findings): the housing image really renders, the pager can be dragged by its housing
// (keys stay clickable, the personal position survives a reload and stays in view), and the package sounds play:
// ping for normal, alarm for urgent, nothing when muted, a blocked sound plays at the first interaction.
// The GM's mirror shows the same housing. 1920, 1440, 125 % and 375 px. Run against the --ultio-pager fixture.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8875','8881'].includes(new URL(base).port),'Use the isolated synthetic pager fixture only');
const output='.local-work/ux-check/ultio-pager-tisch';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25},{name:'375',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true}];
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
// Records every pager sound the page plays. With __soundBlocked, play() is refused until the first tap (autoplay rule).
const probe=blocked=>{window.__pagerSounds=[];window.__soundBlocked=blocked;window.addEventListener('pointerdown',()=>{window.__soundBlocked=false;},true);
 const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(/\/spieltisch\/pager\//.test(this.src)){if(window.__soundBlocked)return Promise.reject(new DOMException('blocked','NotAllowedError'));window.__pagerSounds.push(this.src.split('/').pop());}return play.call(this);};};
async function account(id,options,blocked=false){const context=await browser.newContext(options);await context.addInitScript(probe,blocked);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(phase+' '+label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
let setup,room;
async function stage(command){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:s.version,command}});assert.equal(r.status(),200,JSON.stringify(command));}
async function calm(){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();for(const p of s.pagers||[])await stage({action:'pagerWithdraw',id:p.id});}
const device=p=>p.locator('section[aria-label="Pager"] [aria-roledescription="Pager"]');
const sounds=p=>p.evaluate(()=>window.__pagerSounds.slice());
async function shellRendered(p,scope,label){
 const img=p.locator(scope+' img[src$="ultio-shell.webp"]').first();await img.waitFor();
 const [natural,complete,visible]=await img.evaluate(e=>[e.naturalWidth,e.complete,getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'&&+getComputedStyle(e).opacity>0]);
 assert.ok(complete&&natural===1448,label+': ULTIO housing loaded ('+natural+')');assert.ok(visible,label+': housing visible');
 const box=await img.boundingBox();assert.ok(box&&box.width>60&&Math.abs(box.width/box.height-1448/1086)<.03,label+': housing undistorted '+JSON.stringify(box));
 return box;
}
async function settle(p){await p.waitForTimeout(900);}
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const s0=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();
 if(s0.media&&!s0.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:s0.media.id,audience:{scope:'all'}}});
 if(s0.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:s0.sceneEventId,audience:{scope:'all'}}});
 await calm();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',options,true)]);
  const [sl,pa,pb]=await Promise.all([table(gm,'SL'),table(a,'A'),table(b,'B')]);
  await pa.mouse.click(5,5); // A has interacted with the page before the message arrives; B has not.
  // 1 + 3: a normal message: housing renders, ping plays for A; B's blocked ping plays at the first tap.
  await stage({action:'pager',text:'Ruf mich an · '+name,title:'Wichtig',sender:'Schäfer',recipients:null});
  await device(pa).waitFor();await settle(pa);
  await shellRendered(pa,'section[aria-label="Pager"]',name+' A');
  await pa.waitForFunction(()=>window.__pagerSounds.includes('ping-normal.wav'));
  await device(pb).waitFor();await settle(pb);assert.deepEqual(await sounds(pb),[],'B: blocked, nothing played yet');
  await pb.mouse.click(5,5);await pb.waitForFunction(()=>window.__pagerSounds.includes('ping-normal.wav'));
  // The GM's mirror shows the same housing.
  await sl.getByRole('region',{name:'Pager-Spiegel'}).waitFor();await settle(sl);await shellRendered(sl,'section[aria-label="Pager-Spiegel"]',name+' SL mirror');
  assert.equal(await sl.locator('section[aria-label="Pager"]').count(),0,'The GM has no player device');
  await pa.screenshot({path:output+'/'+name+'-spieler-a.png'});await sl.screenshot({path:output+'/'+name+'-sl-spiegel.png'});
  pass(name+': housing loaded, visible and undistorted for player and GM mirror; ping plays, a blocked ping plays at the first tap');
  // Urgent: alarm. Muted: nothing.
  await stage({action:'pager',text:'Sofort raus · '+name,priority:'hoch',recipients:null});
  await pa.waitForFunction(()=>window.__pagerSounds.includes('alarm-urgent.wav'));
  await pa.getByRole('button',{name:'Pager stummschalten'}).click();const before=(await sounds(pa)).length;
  await stage({action:'pager',text:'Leise · '+name,recipients:null});await pa.getByText('Leise · '+name).or(pa.locator('[data-pager-badge]')).first().waitFor({state:'attached'}).catch(()=>{});await pa.waitForTimeout(2500);
  assert.equal((await sounds(pa)).length,before,'Muted: no sound');
  await pa.getByRole('button',{name:'Pager-Ton einschalten'}).click();
  pass(name+': urgent message plays the alarm; mute is respected');
  // 2: drag by the housing; keys keep working; the position survives a reload and stays in view.
  const start=await device(pa).boundingBox();
  const grip={x:start.x+start.width*.5,y:start.y+start.height*.1};
  const dx=name==='375'?0:-320,dy=name==='375'?-160:-220;
  await pa.mouse.move(grip.x,grip.y);await pa.mouse.down();await pa.mouse.move(grip.x+dx/2,grip.y+dy/2,{steps:6});await pa.mouse.move(grip.x+dx,grip.y+dy,{steps:6});await pa.mouse.up();
  const moved=await device(pa).boundingBox();
  assert.ok(Math.abs(moved.x-start.x-dx)<12&&Math.abs(moved.y-start.y-dy)<12,name+': drag moves the pager '+JSON.stringify({start,moved}));
  const view=await pa.locator('[aria-roledescription="Pager"] [data-view]').getAttribute('data-view');
  await pa.getByRole('button',{name:'Menü: Ansicht wechseln'}).click();
  assert.notEqual(await pa.locator('[aria-roledescription="Pager"] [data-view]').getAttribute('data-view'),view,'Keys still work after dragging');
  await pa.reload();await pa.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();
  await pa.getByRole('button',{name:/^Pager öffnen/}).click();await settle(pa);
  const again=await device(pa).boundingBox();assert.ok(Math.abs(again.x-moved.x)<6&&Math.abs(again.y-moved.y)<6,name+': position remembered '+JSON.stringify({moved,again}));
  const g=await device(pa).boundingBox();await pa.mouse.move(g.x+g.width*.5,g.y+g.height*.1);await pa.mouse.down();await pa.mouse.move(-3000,-3000,{steps:8});await pa.mouse.up();
  const edge=await pa.locator('section[aria-label="Pager"]').boundingBox(),vp=pa.viewportSize();
  assert.ok(edge.x>=55&&edge.y>=55&&edge.x+edge.width<=vp.width+1&&edge.y+edge.height<=vp.height+1,name+': stays in view '+JSON.stringify(edge));
  const [w,inner]=await pa.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(w<=inner+1,name+': no horizontal scroll');
  assert.equal(await pa.evaluate(()=>String(window.getSelection())),'',name+': dragging selects no page text');
  await pa.screenshot({path:output+'/'+name+'-spieler-a-verschoben.png'});
  pass(name+': dragged by the housing, keys still work, position kept after reload, clamped to the table');
  await calm();await Promise.all([gm.close(),a.close(),b.close()]);
 }
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: ULTIO-Pager am Tisch – Gehäuse, Verschieben, Töne');
}catch(e){console.error('FAIL in phase '+phase);throw e;}
finally{try{await calm();}catch{/* best effort */}await browser.close();}
