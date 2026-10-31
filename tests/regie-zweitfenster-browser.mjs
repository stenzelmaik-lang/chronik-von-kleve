import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Regie im Zweitfenster in real browsers: SL table + SL Regie (opened by the button), Spieler A and B.
// 1920, 1440 and 125 % zoom for everybody, 375 px for a player. Run against scripts/start-regie.ps1.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8870';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8870','8871'].includes(new URL(base).port),'Use the isolated synthetic Regie fixture only');
const output='.local-work/ux-check/regie';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25}];
const mobile={viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='login';
const pass=label=>console.log('PASS '+label);
async function account(id,options){const context=await browser.newContext(options);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
async function table(context,label){const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
const noHorizontalScroll=async(p,label)=>{const [w,inner]=await p.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);assert.ok(w<=inner+1,label+': no horizontal page scroll ('+w+' > '+inner+')');};
try{
 const setup=await account('command-gm',{});
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 const q='/api/live-stage?sessionId='+encodeURIComponent(active.room.sessionId);
 const state=await (await setup.request.get(base+q)).json(),crew=state.crew,room={sessionId:active.room.sessionId,runId:active.room.runId};
 // Start from a calm table: no shared media view or narration left over from other suites.
 if(state.media&&!state.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:state.media.id,audience:{scope:'all'}}});
 if(state.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:state.sceneEventId,audience:{scope:'all'}}});
 const nameA=crew.find(m=>m.id==='command-a').name,nameB=crew.find(m=>m.id==='command-b').name;
 await setup.close();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'})]);
  const [sl,pa,pb]=await Promise.all([table(gm,name+' SL'),table(a,name+' A'),table(b,name+' B')]);
  // One click opens the Regie in its own tab; a second click focuses it instead of opening another.
  const opened=gm.waitForEvent('page');await sl.getByRole('button',{name:'Regie im zweiten Fenster'}).click();const regie=await opened;
  regie.setDefaultTimeout(15000);regie.on('pageerror',e=>errors.push(name+' Regie: '+e.message));
  await regie.waitForURL(/\/sl\/regie/);await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
  await sl.getByRole('button',{name:'Regie im zweiten Fenster'}).click();await regie.waitForTimeout(400);
  assert.equal(gm.pages().length,2,'The remembered Regie tab is reused');
  for(const column of ['Material','Texte zum Vorlesen','Ton & Video','Spielfeld & Effekte'])assert.ok(await regie.getByRole('heading',{name:column,exact:true}).isVisible(),name+': column '+column);
  await noHorizontalScroll(regie,name+' Regie');
  pass(name+': Regie opens from the table in a remembered tab, four areas visible');

  // Pager to A only: A sees it float in, B does not.
  const text='Ruf an, '+name+' – '+Date.now();
  const pager=regie.getByRole('group',{name:'Empfänger: Pager'});
  await pager.getByRole('button',{name:nameA}).click();
  await regie.getByLabel('Pager-Nachricht').fill(text);await regie.getByRole('button',{name:'Pager senden'}).click();
  await pa.getByRole('alertdialog',{name:'Pager-Nachricht'}).getByText(text,{exact:true}).waitFor();
  await pb.waitForTimeout(2000);assert.equal(await pb.getByText(text,{exact:true}).count(),0,'B never sees the pager for A');
  assert.equal(await sl.getByText(text,{exact:true}).count(),0,'The shared SL table never shows a targeted pager');
  await pa.screenshot({path:output+'/'+name+'-spieler-a-pager.png'});
  await pa.getByRole('button',{name:'Gelesen'}).click();await pa.reload();await pa.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();await pa.waitForTimeout(1500);
  assert.equal(await pa.getByText(text,{exact:true}).count(),0,'Read pagers stay read after reload');
  pass(name+': pager reaches A only, animated, read state survives reload');

  // Weather for the whole round; reduced motion keeps it still.
  await regie.getByRole('button',{name:'Regen'}).click();await regie.getByRole('button',{name:'Nebel'}).click();
  for(const p of [pa,pb,sl])await p.locator('[data-effect=rain]').waitFor({state:'attached'});
  await pb.locator('[data-effect=fog]').waitFor({state:'attached'});
  assert.equal(await pb.locator('[data-effect=rain] span').first().evaluate(e=>getComputedStyle(e).animationName),'none','Reduced motion: no rain animation');
  assert.notEqual(await pa.locator('[data-effect=rain] span').first().evaluate(e=>getComputedStyle(e).animationName),'none','Rain animates otherwise');
  await pa.screenshot({path:output+'/'+name+'-spieler-a-effekte.png'});
  pass(name+': rain and fog for the round, reduced motion respected');

  // Background music: personal volume, browser decides about autoplay (start button otherwise).
  await regie.locator('li',{hasText:'Regennacht'}).getByRole('button').click();
  for(const p of [pa,pb])await p.getByRole('group',{name:'Hintergrundmusik'}).waitFor();
  await pa.getByLabel('Eigene Musiklautstärke').fill('0.2');
  assert.equal(await pb.getByLabel('Eigene Musiklautstärke').inputValue(),'0.5','Volume is personal');
  const musicState=await pa.evaluate(()=>{const el=document.querySelector('audio[loop]');return {loop:el?.loop,volume:el?.volume};});
  assert.equal(musicState.loop,true);assert.ok(Math.abs(musicState.volume-.2)<.01);
  pass(name+': background music for all, personal volume');

  // Narration from the text column for B only; the scene choice follows into the table drawer.
  const narration=regie.getByRole('region',{name:'Erzählung'});
  await narration.getByRole('button',{name:nameB}).click();await narration.getByRole('button',{name:/Erzählung freigeben|Erneut freigeben/}).click();
  await pb.getByRole('region',{name:'Freigegebene Erzählung',exact:true}).waitFor();
  await pa.waitForTimeout(1500);assert.equal(await pa.getByRole('region',{name:'Freigegebene Erzählung',exact:true}).count(),0,'A does not get narration meant for B');
  await sl.screenshot({path:output+'/'+name+'-sl-spieltisch.png'});await regie.screenshot({path:output+'/'+name+'-sl-regie.png'});
  assert.ok(await regie.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+1),name+': on large screens only the columns scroll, never the Regie page');
  await regie.getByRole('button',{name:'Erzählung zurückziehen'}).click();
  await pb.getByRole('region',{name:'Freigegebene Erzählung',exact:true}).waitFor({state:'detached'});
  const second=await regie.getByLabel('Szene in der Regie').locator('option').nth(1);const secondId=await second.getAttribute('value'),secondTitle=(await second.textContent()).replace(/^\d+ · /,'').replace(/ · läuft$/,'');
  await regie.getByLabel('Szene in der Regie').selectOption(secondId);
  await sl.getByRole('button',{name:'Regie (privat)'}).click();
  await sl.locator('[data-scene="'+secondId+'"]').waitFor();
  assert.ok(await sl.getByRole('heading',{name:secondTitle}).first().isVisible(),'Table drawer follows the Regie scene');
  await sl.getByRole('button',{name:'Werkzeug schließen'}).click();
  await regie.getByLabel('Szene in der Regie').selectOption(await regie.getByLabel('Szene in der Regie').locator('option').first().getAttribute('value'));
  pass(name+': narration to B only from the text column; scene focus shared with the table drawer');

  // Reset for the next viewport.
  await regie.getByRole('button',{name:'Musik stoppen'}).click();
  await regie.getByRole('button',{name:'Regen'}).click();await regie.getByRole('button',{name:'Nebel'}).click();
  await pa.locator('[data-effect]').first().waitFor({state:'detached'});
  await regie.getByRole('button',{name:'Pager zurückziehen'}).first().click();
  await Promise.all([gm,a,b].map(c=>c.close()));
 }
 // Player on a phone: pager and music fit in 375 px.
 phase='375';
 const [gm,a]=await Promise.all([account('command-gm',{viewport:{width:1440,height:900}}),account('command-a',mobile)]);
 const regie=await gm.newPage();regie.setDefaultTimeout(15000);await regie.goto(base+'/sl/regie');await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
 const pa=await table(a,'375 A');
 const text='Treffpunkt Tor 3 – mobil '+Date.now();
 await regie.getByRole('group',{name:'Empfänger: Pager'}).getByRole('button',{name:nameA}).click();
 await regie.getByLabel('Pager-Nachricht').fill(text);await regie.getByRole('button',{name:'Pager senden'}).click();
 await regie.locator('li',{hasText:'Regennacht'}).getByRole('button').click();
 const box=await pa.getByRole('alertdialog',{name:'Pager-Nachricht'}).boundingBox();
 await pa.getByText(text,{exact:true}).waitFor();await pa.getByRole('group',{name:'Hintergrundmusik'}).waitFor();
 await pa.waitForTimeout(1200);// the pager has floated in
 const settled=await pa.getByRole('alertdialog',{name:'Pager-Nachricht'}).boundingBox();
 assert.ok(settled,'Pager visible');console.log('375 pager box '+JSON.stringify(settled));
 assert.ok(settled.x>=0&&settled.x+settled.width<=375+1,'Pager fits the phone width');void box;
 const music=await pa.getByRole('group',{name:'Hintergrundmusik'}).boundingBox();assert.ok(music.x+music.width<=375+1,'Music controls fit');
 await noHorizontalScroll(pa,'375 player');
 await pa.screenshot({path:output+'/375-spieler-a.png'});
 await regie.getByRole('button',{name:'Musik stoppen'}).click();await regie.getByRole('button',{name:'Pager zurückziehen'}).first().click();
 pass('375: pager and music fit a phone');
 await Promise.all([gm,a].map(c=>c.close()));
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: Regie im Zweitfenster in the browser');
}catch(e){console.error('FAIL in '+phase+': '+e.message);process.exitCode=1;}
finally{await browser.close();}
