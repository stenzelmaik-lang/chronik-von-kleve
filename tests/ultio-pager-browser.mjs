import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// ULTIO pager R-03 in real browsers: Regie window (prepared + spontaneous) and the player table.
// 1920, 1440 and 125 % zoom; a touch phone with 375 px. Run against scripts/start-ultio-pager.ps1 (port 8874).
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8874';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8875','8881'].includes(new URL(base).port),'Use the isolated synthetic pager fixture only');
const output='.local-work/ux-check/ultio-pager';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25}];
const mobile={viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[],pages=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
// Records which pager sounds the page tries to play (the browser may still block them; nothing is forced).
const soundProbe=()=>{window.__pagerSounds=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(/\/spieltisch\/pager\//.test(this.src))window.__pagerSounds.push(this.src.split('/').pop());return play.call(this);};};
async function account(id,options){const context=await browser.newContext(options);await context.addInitScript(soundProbe);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
async function table(context,label){const p=await context.newPage();pages.push([label,p]);p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
async function regieWindow(context,label){const p=await context.newPage();pages.push([label,p]);p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));await p.goto(base+'/sl/regie');await p.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();return p;}
const noHorizontalScroll=async(p,label)=>{const [w,inner]=await p.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);assert.ok(w<=inner+1,label+': no horizontal page scroll ('+w+' > '+inner+')');};
const sounds=p=>p.evaluate(()=>window.__pagerSounds.slice());
const view=p=>p.locator('[aria-roledescription="Pager"] [data-view]').getAttribute('data-view');
const key=(p,name)=>p.getByRole('button',{name:{menu:'Menü: Ansicht wechseln',up:'Nach oben',down:'Nach unten',ok:'OK: öffnen oder quittieren',back:'Zurück'}[name],exact:true});
let room,setup;
async function calm(){
 // Withdraw every pager of the run so prepared messages can be played again in the next viewport.
 const state=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();
 let version=state.version;
 for(const p of state.pagers||[]){const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:version,command:{action:'pagerWithdraw',id:p.id}}});assert.equal(r.status(),200);version=(await r.json()).version;}
}
async function deviceGeometry(p,label,viewport){
 const device=await p.locator('[aria-roledescription="Pager"]').boundingBox();
 assert.ok(device,label+': device visible');
 // The device lies slightly turned on the table; its own (unrotated) box keeps the artwork's ratio.
 const [w,h,bg]=await p.locator('[aria-roledescription="Pager"]').evaluate(e=>[e.offsetWidth,e.offsetHeight,getComputedStyle(e.parentElement).backgroundImage+getComputedStyle(e.parentElement).backgroundColor+getComputedStyle(e.parentElement).borderTopWidth]);
 assert.ok(Math.abs(w/h-1448/1086)<.01,label+': housing keeps its aspect ratio ('+(w/h).toFixed(3)+')');
 assert.equal(bg,'nonergba(0, 0, 0, 0)0px',label+': free-standing device, no panel or frame behind it');
 assert.ok(device.x>=0&&device.y>=0&&device.x+device.width<=viewport.width+1&&device.y+device.height<=viewport.height+1,label+': device fully in view '+JSON.stringify(device));
 const keys=[];for(const k of ['menu','up','down','ok','back']){const b=await key(p,k).boundingBox();assert.ok(b.x>=device.x&&b.x+b.width<=device.x+device.width+1&&b.y+b.height<=device.y+device.height+1,label+': key '+k+' on the device');keys.push(b);}
 for(let i=1;i<keys.length;i++)assert.ok(keys[i].x>=keys[i-1].x+keys[i-1].width-1,label+': key areas do not overlap');
 const screen=await p.locator('[aria-roledescription="Pager"] [data-view]').boundingBox();
 assert.ok(screen.y+screen.height<=keys[0].y+1,label+': LCD sits above the keys');
 return device;
}
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const initial=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json(),crew=initial.crew;
 // Start from a calm table: a shared media view or narration left over from other suites would cover the pager.
 if(initial.media&&!initial.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:initial.media.id,audience:{scope:'all'}}});
 if(initial.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:initial.sceneEventId,audience:{scope:'all'}}});
 const nameA=crew.find(m=>m.id==='command-a').name,nameB=crew.find(m=>m.id==='command-b').name;
 await calm();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'})]);
  const [regie,sl,pa,pb]=await Promise.all([regieWindow(gm,name+' Regie'),table(gm,name+' SL'),table(a,name+' A'),table(b,name+' B')]);
  await pa.evaluate(()=>{try{localStorage.removeItem('chroniplay:pager-ton:command-a');}catch{/* ignore */}});

  // Prepared in the Command Center, listed in the Regie with its intended recipient, then played.
  const prepared=regie.getByRole('list',{name:'Vorbereitete Pager'});
  const suedtor=prepared.locator('li',{hasText:'SÜDTOR'});
  await suedtor.waitFor();
  assert.equal(await suedtor.getByRole('group',{name:/Empfänger/}).getByRole('button',{name:nameA}).getAttribute('aria-pressed'),'true',name+': prepared recipient A is preselected');
  await suedtor.getByRole('button',{name:'Ausspielen'}).click();
  const region=pa.getByRole('region',{name:'Pager'});
  await region.getByText('SÜDTOR').waitFor();
  assert.equal(await view(pa),'inbox',name+': the device floats in on the inbox');
  await pb.waitForTimeout(1500);assert.equal(await pb.getByRole('region',{name:'Pager'}).count(),0,name+': B receives nothing for A');
  // The GM gets no player device, only the read-only mirror of sent pagers (since the Regie-Nachbesserung).
  assert.equal(await sl.getByRole('region',{name:'Pager',exact:true}).count(),0,name+': the shared SL table never shows a player pager');
  assert.equal(await sl.locator('[aria-roledescription="Pager"]').count(),0,name+': no pager device for the GM');
  await suedtor.getByText(/Gesendet .* an /).waitFor();
  await deviceGeometry(pa,name+' A',options.viewport);
  assert.ok((await sounds(pa)).includes('alarm-urgent.wav'),name+': an urgent message tries the alarm sound');
  await pa.waitForTimeout(800);await pa.screenshot({path:output+'/'+name+'-spieler-a-eingang.png'});
  pass(name+': prepared pager played from the Regie, floats in at A only, device unverzerrt and in view');

  // A click outside the keys does nothing; the five key areas and the keyboard steer the device.
  const device=pa.locator('[aria-roledescription="Pager"]');const box=await device.boundingBox();
  for(const [x,y] of [[.5,.42],[.5,.08],[.04,.5],[.95,.95]])await pa.mouse.click(box.x+box.width*x,box.y+box.height*y);
  assert.equal(await view(pa),'inbox',name+': clicks on housing and LCD trigger nothing');
  await key(pa,'menu').click();assert.equal(await view(pa),'status');
  await key(pa,'menu').click();assert.equal(await view(pa),'home');
  await key(pa,'ok').click();assert.equal(await view(pa),'inbox');
  await device.focus();await pa.keyboard.press('m');assert.equal(await view(pa),'status','M = MENU');
  await pa.keyboard.press('Escape');assert.equal(await view(pa),'home','Escape = back');
  await pa.keyboard.press('Enter');await pa.keyboard.press('ArrowDown');await pa.keyboard.press('ArrowUp');await pa.keyboard.press('Enter');
  assert.equal(await view(pa),'message');await device.getByText('In 10 Minuten am Südtor. Komm allein.').waitFor();
  assert.equal(await device.getAttribute('data-theme'),'red',name+': urgent message on a red LCD');
  await pa.screenshot({path:output+'/'+name+'-spieler-a-meldung.png'});
  await pa.keyboard.press('Enter');await device.getByText('QUITTIERT ✓').waitFor();
  await suedtor.getByText('Gelesen: '+nameA).waitFor();
  pass(name+': five key areas and keyboard work; OK acknowledges to the Regie');

  // Mute, fold, then a spontaneous message to A and B: badge, no sound while muted, reduced motion at B.
  await pa.getByRole('button',{name:'Pager stummschalten'}).click();
  await pa.getByRole('button',{name:'Pager zuklappen'}).click();
  const launcher=pa.getByRole('button',{name:/^Pager öffnen/});await launcher.waitFor();
  const before=(await sounds(pa)).length;
  const text='Spontan '+name+' '+Date.now();
  const form=regie.locator('form',{has:regie.getByLabel('Pager-Nachricht')});
  await form.getByRole('group',{name:'Empfänger: Pager'}).getByRole('button',{name:nameA}).click();
  await form.getByRole('group',{name:'Empfänger: Pager'}).getByRole('button',{name:nameB}).click();
  await regie.getByLabel('Pager-Absender').fill('UNBEKANNT');await regie.getByLabel('Pager-Nachricht').fill(text);
  await regie.getByRole('button',{name:'Pager senden'}).click();
  await region.getByText(text,{exact:true}).waitFor();
  assert.equal((await sounds(pa)).length,before,name+': muted pager stays silent');
  await pb.getByRole('region',{name:'Pager'}).getByText(text,{exact:true}).waitFor();
  assert.ok((await sounds(pb)).includes('ping-normal.wav'),name+': B (not muted) tries the normal ping');
  const motion=await pb.locator('[aria-roledescription="Pager"]').evaluate(e=>getComputedStyle(e.parentElement).animationName);
  assert.equal(motion,'none',name+': reduced motion: the pager does not fly in');
  await pa.getByRole('button',{name:'Pager zuklappen'}).click();
  assert.equal(await pa.locator('[data-pager-badge]').textContent(),'1',name+': badge counts the unopened message');
  await pa.screenshot({path:output+'/'+name+'-spieler-a-zugeklappt.png'});
  await regie.screenshot({path:output+'/'+name+'-regie-pager.png'});
  pass(name+': mute, fold with badge, spontaneous pager to A and B, reduced motion');

  // Reload: state from the real ids, no second ring, mute remembered, no duplicates.
  await pa.reload();await pa.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();
  await launcher.waitFor();assert.equal(await pa.locator('[data-pager-badge]').textContent(),'1',name+': badge restored after reload');
  await pa.waitForTimeout(1500);assert.deepEqual(await sounds(pa),[],name+': nothing rings again after reload');
  await launcher.click();assert.equal(await pa.getByRole('button',{name:'Pager-Ton einschalten'}).getAttribute('aria-pressed'),'true',name+': mute remembered');
  await key(pa,'ok').click();assert.equal(await view(pa),'inbox');
  assert.equal(await pa.locator('[aria-roledescription="Pager"] li[data-message]').count(),2,name+': two messages, no duplicates');
  assert.equal(await pa.locator('li[data-acknowledged=true]').count(),1,name+': the acknowledged one stays acknowledged');
  await noHorizontalScroll(pa,name+' A');await noHorizontalScroll(regie,name+' Regie');
  pass(name+': reload restores the pager from the server ids');

  await calm();
  await Promise.all([gm,a,b].map(c=>c.close()));
 }

 // A touch phone with 375 px: the whole device stays visible; taps on the key areas work.
 phase='375';
 const [gm,a]=await Promise.all([account('command-gm',{viewport:{width:1440,height:900}}),account('command-a',mobile)]);
 const regie=await regieWindow(gm,'375 Regie');const pa=await table(a,'375 A');
 await regie.getByRole('list',{name:'Vorbereitete Pager'}).locator('li',{hasText:'LAGE'}).getByRole('button',{name:'Ausspielen'}).click();
 await pa.getByRole('region',{name:'Pager'}).getByText('LAGE').waitFor();await pa.waitForTimeout(900);
 const phone=await deviceGeometry(pa,'375 A',mobile.viewport);
 assert.ok(phone.x>=56,'375: the device is not covered by the 56 px tool rail (x='+phone.x+')');
 await key(pa,'ok').tap();assert.equal(await view(pa),'message');
 await pa.locator('[aria-roledescription="Pager"]').getByText('Funkstille bis 23:40. Weitere Anweisungen folgen.').waitFor();
 await pa.screenshot({path:output+'/375-spieler-a.png'});
 await key(pa,'ok').tap();await pa.getByText('QUITTIERT ✓').waitFor();
 await key(pa,'back').tap();await key(pa,'back').tap();await key(pa,'back').tap();
 await pa.getByRole('button',{name:/^Pager öffnen/}).waitFor();
 const folded=await pa.getByRole('button',{name:/^Pager öffnen/}).boundingBox();assert.ok(folded.x>=0&&folded.x+folded.width<=375+1,'Folded pager fits '+JSON.stringify(folded));
 await noHorizontalScroll(pa,'375 player');
 await pa.screenshot({path:output+'/375-spieler-a-zugeklappt.png'});
 pass('375: device fully visible, tap on the key areas, fold with the back key');
 await calm();
 await Promise.all([gm,a,setup].map(c=>c.close()));
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: ULTIO pager in the browser');
}catch(e){console.error('FAIL in '+phase+': '+e.message);process.exitCode=1;for(const [label,p] of pages)if(!p.isClosed())await p.screenshot({path:output+'/fehler-'+label.replace(/\W+/g,'-')+'.png'}).catch(()=>{});}
finally{await browser.close();}
