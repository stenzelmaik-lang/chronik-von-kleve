import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Live acceptance defects of the ULTIO pager in real browsers (docs/spieltisch-2-0/ULTIO-Pager-Fehlerbericht.md):
// 1 tone on new messages only (no ring on reload, duplicates or late syncs, one ring per sync, mute, activation offer),
// 2 opened = read, at once, persistent on the server, only for the recipient, shown in the Regie,
// 3 key hit areas exactly on the key caps at every size, no hit areas beside them, keyboard and focus ring intact.
// SL (Regie window), Spieler A and Spieler B; 1920, 1440, 125 % and a 375 px touch phone. Run against the --ultio-pager fixture.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8884';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8884'].includes(new URL(base).port),'Use the isolated synthetic pager fixture only');
const output='.local-work/ux-check/ultio-pager-fixes';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25},{name:'375',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true}];
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
// Same Web Audio probe as tests/ultio-pager-tisch-browser.mjs: records played pager sounds, can simulate the autoplay block.
const probe=blocked=>{window.__pagerSounds=[];window.__soundBlocked=blocked;window.addEventListener('pointerdown',()=>{window.__soundBlocked=false;},true);
 const names=new WeakMap(),load=window.fetch;
 window.fetch=function(...args){const url=String(args[0]?.url||args[0]);return load.apply(this,args).then(r=>{if(/\/spieltisch\/pager\/.+\.wav/.test(url)){const read=r.arrayBuffer.bind(r);r.arrayBuffer=()=>read().then(b=>{names.set(b,url.split('/').pop());return b;});}return r;});};
 const AC=window.AudioContext,decode=AC.prototype.decodeAudioData,state=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'state');
 AC.prototype.decodeAudioData=function(b,...rest){const n=names.get(b);return decode.call(this,b,...rest).then(buf=>{if(n)names.set(buf,n);return buf;});};
 Object.defineProperty(AC.prototype,'state',{configurable:true,get(){return window.__soundBlocked?'suspended':state.get.call(this);}});
 const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...rest){const n=this.buffer&&names.get(this.buffer);if(n)window.__pagerSounds.push(n);return start.apply(this,rest);};};
async function account(id,options,blocked=false){const context=await browser.newContext(options);await context.addInitScript(probe,blocked);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(phase+' '+label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
let setup,room;
async function stage(command){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:s.version,command}});assert.equal(r.status(),200,JSON.stringify(command));}
async function calm(){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();for(const p of s.pagers||[])await stage({action:'pagerWithdraw',id:p.id});}
const gmPager=async text=>(await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json()).pagers.find(p=>p.text===text);
const device=p=>p.locator('section[aria-label="Pager"] [aria-roledescription="Pager"]');
const sounds=p=>p.evaluate(()=>window.__pagerSounds.slice());
const view=p=>device(p).locator('[data-view]').getAttribute('data-view');
const key=(p,k)=>device(p).locator('[data-key='+k+']');
const badge=p=>p.locator('[data-pager-badge]');
/** Into the inbox from whatever view the device remembers (back never folds before home is reached). */
async function toInbox(p){for(let i=0;i<3&&!['home','inbox'].includes(await view(p));i++)await key(p,'back').click();if(await view(p)==='home')await key(p,'ok').click();assert.equal(await view(p),'inbox');}
async function folded(p){if(await device(p).count())await p.getByRole('button',{name:'Pager zuklappen'}).click();await p.getByRole('button',{name:/^Pager öffnen/}).waitFor();}
// Key caps measured on the 1448 x 1086 artwork (see the error report).
const caps={menu:[170,358],up:[396,580],down:[612,828],ok:[858,1046],back:[1084,1268]},capY=[746,888];
/** Screen point of an artwork point on the (slightly rotated) device, and what is hit there. */
const hitAt=(p,points)=>device(p).evaluate((dev,pts)=>pts.map(([x,y])=>{
 const probe=document.createElement('i');probe.style.cssText='position:absolute;width:0;height:0;left:'+(x/1448*100)+'%;top:'+(y/1086*100)+'%';
 dev.append(probe);const r=probe.getBoundingClientRect();probe.remove();
 const hit=document.elementFromPoint(r.x,r.y);return {x:r.x,y:r.y,key:hit?.closest('[data-key]')?.getAttribute('data-key')||null,inDevice:dev.contains(hit)};}),points);
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const s0=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json(),crew=s0.crew;
 if(s0.media&&!s0.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:s0.media.id,audience:{scope:'all'}}});
 if(s0.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:s0.sceneEventId,audience:{scope:'all'}}});
 const nameA=crew.find(m=>m.id==='command-a').name;
 await calm();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',{viewport:{width:1440,height:900}}),account('command-a',options),account('command-b',options)]);
  const regie=watch(await gm.newPage(),'Regie');await regie.goto(base+'/sl/regie');await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
  const [pa,pb]=await Promise.all([table(a,'A'),table(b,'B')]);
  await pa.mouse.click(5,5);await pb.mouse.click(5,5);// both have interacted with the page: sound is allowed

  // --- 1 Tone: one ring per new message; two in one sync are one ring; nothing for duplicates, reload or mute.
  const t1='Erste '+name,t2='Zweite '+name,t3='Dritte '+name;
  await stage({action:'pager',text:t1,sender:'ZENTRALE',recipients:null});
  await device(pa).waitFor();await pa.waitForFunction(()=>window.__pagerSounds.length>=1,undefined,{polling:200});
  assert.deepEqual(await sounds(pa),['ping-normal.wav'],name+': one ping for a new message');
  await stage({action:'pager',text:t2,priority:'hoch',recipients:['command-a']});await stage({action:'pager',text:t3,recipients:['command-a']});
  await pa.waitForFunction(()=>window.__pagerSounds.length>=2,undefined,{polling:200});await pa.waitForTimeout(2500);
  const rang=await sounds(pa);assert.ok(rang.length<=3&&rang.includes('alarm-urgent.wav'),name+': the urgent message rings the alarm, no pile-up '+JSON.stringify(rang));
  const count=rang.length;await pa.waitForTimeout(2500);assert.equal((await sounds(pa)).length,count,name+': further syncs of the same ids stay silent');
  assert.deepEqual(await sounds(pb),['ping-normal.wav'],name+': B rings only for the message meant for B as well');
  pass(name+': tone for new messages, alarm for urgent, no repeat on sync');

  // --- 2 Read: opening shows the content and counts as read at once, for A only, and the Regie sees it.
  await folded(pa);assert.equal(await badge(pa).textContent(),'3',name+': three unread');
  await pa.getByRole('button',{name:/^Pager öffnen/}).click();await device(pa).waitFor();
  await toInbox(pa);
  // Newest first: t3, t2, t1. Open t1 (oldest, the message for everybody).
  await key(pa,'down').click();await key(pa,'down').click();await key(pa,'ok').click();
  assert.equal(await view(pa),'message');await device(pa).getByText(t1,{exact:true}).waitFor();
  await key(pa,'back').click();await key(pa,'back').click();
  assert.match(await device(pa).locator('[data-view=home]').textContent(),/2\s*NEUE MELDUNGEN/,name+': the counter drops at once');
  await folded(pa);assert.equal(await badge(pa).textContent(),'2',name+': badge drops at once');
  await regie.getByRole('list',{name:'Gesendete Pager'}).locator('li',{hasText:t1}).getByText('Gelesen: '+nameA).waitFor();
  const shared=await gmPager(t1);assert.deepEqual(shared.reads.map(x=>x.id),['command-a'],name+': read stored on the server for A only');assert.equal(shared.acks,undefined,name+': reading is not acknowledging');
  await folded(pb);assert.equal(await badge(pb).textContent(),'1',name+': B still has its own unread copy');
  // Reload and a fresh browser without storage: still read; late snapshots never reset it; nothing rings on reload.
  await pa.reload();await pa.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();await pa.waitForTimeout(2500);
  assert.equal(await badge(pa).textContent(),'2',name+': read survives a reload');assert.deepEqual(await sounds(pa),[],name+': nothing rings on reload');
  const a2=await account('command-a',options),fresh=await table(a2,'A2');await fresh.waitForTimeout(1500);
  assert.equal(await badge(fresh).textContent(),'2',name+': read comes from the server in a fresh browser');
  await a2.close();
  pass(name+': opened = read, at once, persistent, only for A, visible in the Regie');

  // --- 3 Keys: each cap centre hits its key; seams, bezel and LCD hit no key. Keyboard and focus ring still work.
  await pa.getByRole('button',{name:/^Pager öffnen/}).click();await device(pa).waitFor();await pa.waitForTimeout(900);
  const centres=Object.values(caps).map(([x0,x1])=>[(x0+x1)/2,(capY[0]+capY[1])/2]);
  const corners=Object.values(caps).flatMap(([x0,x1])=>[[x0+32,capY[0]+32],[x1-32,capY[1]-32]]);
  const outside=[[377,817],[596,817],[843,817],[1065,817],[264,735],[952,900],[700,480],[1300,817],[120,817]];
  const onCaps=await hitAt(pa,[...centres,...corners]);
  Object.keys(caps).forEach((k,i)=>assert.equal(onCaps[i].key,k,name+': cap centre of '+k+' hits '+onCaps[i].key));
  Object.keys(caps).forEach((k,i)=>{assert.equal(onCaps[5+2*i].key,k,name+': upper inner corner of '+k);assert.equal(onCaps[6+2*i].key,k,name+': lower inner corner of '+k);});
  for(const [i,h] of (await hitAt(pa,outside)).entries())assert.equal(h.key,null,name+': no key beside the caps at '+outside[i]);
  // A tap or click on the cap really presses that key.
  const before=await view(pa);const menu=onCaps[0];
  if(options.hasTouch)await pa.touchscreen.tap(menu.x,menu.y);else await pa.mouse.click(menu.x,menu.y);
  assert.notEqual(await view(pa),before,name+': pressing the MENU cap changes the view');
  // Keyboard: Tab reaches the keys, the focus ring sits on the cap, Enter on a key presses it.
  await key(pa,'up').focus();await pa.keyboard.press('Shift+Tab');await pa.keyboard.press('Tab');
  assert.equal(await pa.evaluate(()=>document.activeElement?.getAttribute('data-key')),'up',name+': keyboard focus on a key');
  const ring=await key(pa,'up').evaluate(e=>getComputedStyle(e).boxShadow);assert.ok(ring&&ring!=='none',name+': visible focus ring');
  const vBefore=await view(pa);await device(pa).focus();await pa.keyboard.press('m');assert.notEqual(await view(pa),vBefore,name+': M still works on the focused device');
  await pa.screenshot({path:output+'/'+name+'-spieler-a.png'});
  await key(pa,'menu').focus();await pa.screenshot({path:output+'/'+name+'-spieler-a-fokus.png'});
  await regie.screenshot({path:output+'/'+name+'-regie.png'});
  const [w,inner]=await pa.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(w<=inner+1,name+': no horizontal scroll');
  pass(name+': key hit areas on the caps, nothing beside them, tap/click, keyboard and focus ring');

  // Mute: a new message stays silent but still arrives unread.
  await pa.getByRole('button',{name:'Pager stummschalten'}).click();const quiet='Leise '+name,n=(await sounds(pa)).length;
  await stage({action:'pager',text:quiet,recipients:['command-a']});await device(pa).getByText(quiet).waitFor();await pa.waitForTimeout(1500);
  assert.equal((await sounds(pa)).length,n,name+': muted pager stays silent');
  await pa.getByRole('button',{name:'Pager-Ton einschalten'}).click();
  pass(name+': mute respected');
  await calm();await Promise.all([gm.close(),a.close(),b.close()]);
 }
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: ULTIO-Pager – Ton, Lesestatus, Tasten');
}catch(e){console.error('FAIL in phase '+phase+': '+e.message+' @ '+(e.stack||'').split(/\n/).filter(l=>l.includes('fixes-browser')).join(' | '));process.exitCode=1;}
finally{try{await calm();}catch{/* best effort */}await browser.close();}
