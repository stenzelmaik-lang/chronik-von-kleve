import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Ambience player (YouTube) in real browsers against a simulated IFrame Player API: no request ever reaches YouTube.
// Drawer from the corner, turning record, scene start with automatic playlist, GM controls, personal volume,
// blocked autoplay hint, no overlap with round overview, dice dock and pressure. 1920, 1440, 125 % and 375 px.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8875','8881'].includes(new URL(base).port),'Use the isolated synthetic fixture only');
const output='.local-work/ux-check/ambiente';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25}];
const mobile={viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[],external=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
// Simulated IFrame Player API: same surface as the official one, states 1 playing / 2 paused / 0 ended.
// With window.__ytBlock, playVideo only starts right after a click, like a browser blocking autoplay with sound.
const fakeApi=`(()=>{const log=window.__yt={players:[]};
 class Player{constructor(el,o){this.o=o;this.videoId=o.videoId;this.state=-1;this.volume=100;this.muted=false;this.host=o.host;el.setAttribute('data-fake-youtube',o.videoId);this.el=el;log.players.push(this);setTimeout(()=>o.events.onReady({target:this}),30);}
  set(s){this.state=s;this.el.setAttribute('data-state',s);this.el.setAttribute('data-fake-youtube',this.videoId);this.o.events.onStateChange({data:s,target:this});}
  playVideo(){if(window.__ytBlock&&!(Date.now()-(window.__lastClick||0)<1500))return;this.set(1);}
  pauseVideo(){this.set(2);} loadVideoById(id){this.videoId=id;this.set(3);setTimeout(()=>this.playVideo(),20);}
  seekTo(){} setVolume(v){this.volume=v;this.el.setAttribute('data-volume',v);} getVolume(){return this.volume;} mute(){this.muted=true;} unMute(){this.muted=false;}
  getPlayerState(){return this.state;} destroy(){this.destroyed=true;} end(){this.set(0);} }
 window.YT={Player};setTimeout(()=>window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady(),10);})();`;
async function account(id,options,block=false){
 const context=await browser.newContext(options);
 await context.route(/youtube|ytimg|googlevideo|doubleclick/,route=>{const url=route.request().url();if(url==='https://www.youtube.com/iframe_api')return route.fulfill({contentType:'text/javascript',body:fakeApi});external.push(url);return route.abort();});
 if(block)await context.addInitScript(()=>{window.__ytBlock=true;window.addEventListener('click',()=>{window.__lastClick=Date.now();},true);});
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;
}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(phase+' '+label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
const fake=p=>p.locator('[data-fake-youtube]');
const record=p=>p.locator('button[class*=record]');
const overlap=(r,s)=>r&&s&&r.x<s.x+s.width&&s.x<r.x+r.width&&r.y<s.y+s.height&&s.y<r.y+r.height;
async function noCover(p,label){
 const own=[await record(p).boundingBox(),await p.locator('[class*=drawer][aria-hidden=false]').boundingBox().catch(()=>null)].filter(Boolean);
 for(const sel of ['nav[aria-label="Spielaktionen"]','button[class*=bodyHud]','button[aria-label="Stress und Maskerade öffnen"]','button[aria-label="Kontext öffnen"]']){
  const other=await p.locator(sel).first().boundingBox().catch(()=>null);if(!other)continue;
  for(const box of own)assert.ok(!overlap(box,other),label+': ambience does not cover '+sel+' '+JSON.stringify({box,other}));
 }
}
let setup,room,first,second,original,loadedVersion;
async function stage(command){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:s.version,command}});assert.equal(r.status(),200,JSON.stringify(command));}
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const state=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId)+'&catalog=1')).json();[first,second]=state.scenes;
 if(state.media&&!state.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:state.media.id,audience:{scope:'all'}}});
 if(state.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:state.sceneEventId,audience:{scope:'all'}}});
 const loaded=await (await setup.request.get(base+'/api/command-center/scenes?id='+encodeURIComponent(first.id))).json();original=loaded.scene.document.youtube;loadedVersion=loaded.scene.version;
 const saved=await setup.request.post(base+'/api/command-center/scenes',{headers:{Origin:base},data:{action:'save',id:first.id,version:loadedVersion,document:{...loaded.scene.document,youtube:[{id:crypto.randomUUID(),title:'Ambiente-Beispiel',videoId:'l8GAZU4eY7g'},{id:crypto.randomUUID(),title:'Zweiter Titel',videoId:'dQw4w9WgXcQ'}]}}});
 assert.equal(saved.status(),200);
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  await stage({action:'youtube',video:null});await stage({action:'activateScene',sceneId:second.id});
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'},true)]);
  const [sl,pa,pb]=await Promise.all([table(gm,'SL'),table(a,'A'),table(b,'B')]);
  const regie=watch(await gm.newPage(),'Regie');await regie.goto(base+'/sl/regie');await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
  // Scene start with automatic playlist: the GM starts the first scene from the Regie window.
  await regie.getByLabel('Szene in der Regie').selectOption(first.id);
  await regie.locator('header').getByRole('button',{name:'Szene starten'}).first().click();
  for(const p of [pa,sl])await fake(p).and(p.locator('[data-state="1"]')).waitFor({state:'attached'});
  assert.equal(await fake(pa).getAttribute('data-fake-youtube'),'l8GAZU4eY7g');
  assert.equal(await pa.evaluate(()=>window.__yt.players[0].host),'https://www.youtube-nocookie.com');
  await pa.waitForFunction(()=>window.__yt.players[0].volume===25);
  // The record turns while it plays; the drawer opens from the corner and folds back, the music keeps playing.
  await record(pa).and(pa.locator('[data-spinning=true]')).waitFor();
  assert.notEqual(await record(pa).locator('span').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await noCover(pa,name+' A folded');
  await record(pa).click();await pa.getByRole('complementary',{name:'Ambiente-Musik'}).getByText('Titel 1/2').waitFor();
  await pa.waitForTimeout(450);await noCover(pa,name+' A open');await pa.screenshot({path:output+'/'+name+'-spieler-a-offen.png'});
  await pa.getByRole('button',{name:'Ambiente-Player einklappen'}).last().click();
  assert.equal(await fake(pa).getAttribute('data-state'),'1','Folded, the music keeps playing');
  // B: reduced motion keeps the record still; a blocked start shows the hint, a tap plays.
  await pb.getByRole('button',{name:'Zum Abspielen tippen'}).waitFor();
  await pb.getByRole('button',{name:'Zum Abspielen tippen'}).click();await fake(pb).and(pb.locator('[data-state="1"]')).waitFor({state:'attached'});
  assert.equal(await record(pb).locator('span').first().evaluate(e=>getComputedStyle(e).animationName),'none','Reduced motion: still record');
  pass(name+': scene start plays its playlist; drawer from the corner, record turns, folded keeps playing; tap hint when blocked');
  // GM controls for everyone: pause stops the record, next track fades over, base volume, personal volume stays personal.
  await regie.getByRole('navigation',{name:'Bereiche der Szene'}).getByRole('button',{name:'Ton & Musik',exact:true}).click();
  await regie.getByRole('button',{name:'Pause für alle'}).click();
  await record(pa).and(pa.locator('[data-spinning=false]')).waitFor();await fake(pa).and(pa.locator('[data-state="2"]')).waitFor({state:'attached'});
  await regie.getByRole('button',{name:'Abspielen für alle'}).click();await record(pa).and(pa.locator('[data-spinning=true]')).waitFor();
  await regie.getByRole('button',{name:'Nächster Titel'}).click();
  await pa.waitForFunction(()=>document.querySelector('[data-fake-youtube]')?.getAttribute('data-fake-youtube')==='dQw4w9WgXcQ',null,{timeout:8000});
  await regie.getByLabel('Grundpegel für alle').fill('50');
  await pa.waitForFunction(()=>window.__yt.players[0].volume===50,null,{timeout:8000});
  await record(pa).click();await pa.getByLabel('Eigene Ambiente-Lautstärke').fill('0.5');await pa.waitForFunction(()=>window.__yt.players[0].volume===25);
  await pb.waitForFunction(()=>window.__yt.players[0].volume===50,null,{timeout:8000});
  await pa.reload();await pa.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();await pa.waitForFunction(()=>window.__yt?.players[0]?.volume===25,null,{timeout:8000});
  pass(name+': SL pauses, plays, skips with fade, sets the base volume; personal volume is remembered and stays personal');
  // Spontaneous ambience; a track that ends loops on.
  await regie.getByLabel('YouTube-Links').fill('Wald | https://www.youtube.com/watch?v=l8GAZU4eY7g');await regie.getByLabel('Name des Ambientes').fill('Wald');
  await regie.getByRole('button',{name:'Für alle starten'}).click();await pa.getByRole('complementary',{name:'Ambiente-Musik'}).getByText('Wald').first().waitFor({state:'attached'});
  await pa.evaluate(()=>window.__yt.players[0].end());await fake(pa).and(pa.locator('[data-state="1"]')).waitFor({state:'attached'});
  await regie.screenshot({path:output+'/'+name+'-regie.png'});
  pass(name+': spontaneous ambience for all; an ended track loops');
  await Promise.all([gm.close(),a.close(),b.close()]);
 }
 phase='375';
 await stage({action:'activateScene',sceneId:first.id});
 const a=await account('command-a',mobile),pa=await table(a,'A375');
 await record(pa).waitFor();const box=await record(pa).boundingBox();assert.ok(box.x+box.width<=375+1&&box.y>=56,'Record in the corner of the phone stage');
 await noCover(pa,'375 folded');await record(pa).click();await pa.getByLabel('Eigene Ambiente-Lautstärke').waitFor();
 const drawer=await pa.getByRole('complementary',{name:'Ambiente-Musik'}).boundingBox();assert.ok(drawer.x>=0&&drawer.x+drawer.width<=375+1,'Drawer fits 375 px');
 await pa.waitForTimeout(450);await noCover(pa,'375 open');
 const [w,inner]=await pa.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(w<=inner+1,'No horizontal scroll');
 await pa.screenshot({path:output+'/375-spieler-a.png'});
 pass('375: record and drawer fit and cover nothing');
 assert.deepEqual(external,[],'No request reached YouTube');
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: Ambiente-Player im Browser');
}catch(e){console.error('FAIL in phase '+phase);throw e;}
finally{
 try{await stage({action:'youtube',video:null});const now=await (await setup.request.get(base+'/api/command-center/scenes?id='+encodeURIComponent(first.id))).json();const doc={...now.scene.document};if(original)doc.youtube=original;else delete doc.youtube;await setup.request.post(base+'/api/command-center/scenes',{headers:{Origin:base},data:{action:'save',id:first.id,version:now.scene.version,document:doc}});}catch{/* best effort cleanup */}
 await browser.close();
}
