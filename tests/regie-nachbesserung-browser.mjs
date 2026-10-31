import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Regie-Nachbesserung in real browsers: scene choice opens the Regie window, the persistent area menu, pager
// reception by A and B (also over an open media view) plus the GM mirror and atmosphere effects.
// 1920, 1440 and 125 % for Regie window and table; players also at 375 px. Run against the --ultio-pager fixture.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8875','8881'].includes(new URL(base).port),'Use the isolated synthetic fixture only');
const output='.local-work/ux-check/regie-nachbesserung';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25}];
const mobile={viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
async function account(id,options){const context=await browser.newContext(options);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(phase+' '+label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
const noHorizontalScroll=async(p,label)=>{const [w,inner]=await p.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);assert.ok(w<=inner+1,label+': no horizontal page scroll ('+w+' > '+inner+')');};
let setup,room;
async function command(c){const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:s.version,command:c}});assert.equal(r.status(),200,JSON.stringify(c));return r.json();}
async function calm(){
 const s=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();
 for(const p of s.pagers||[])await command({action:'pagerWithdraw',id:p.id});
 await command({action:'effects',effects:[]});await command({action:'youtube',video:null});
 if(s.media&&!s.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:s.media.id,audience:{scope:'all'}}});
 if(s.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:s.sceneEventId,audience:{scope:'all'}}});
}
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const initial=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId)+'&catalog=1')).json();
 const nameA=initial.crew.find(m=>m.id==='command-a').name;
 const image=initial.catalog.find(o=>o.sourceKind==='file'&&o.mime?.startsWith('image/'));assert.ok(image,'fixture has an image');
 await calm();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'})]);
  const [sl,pa,pb]=await Promise.all([table(gm,'SL'),table(a,'A'),table(b,'B')]);

  // 1. No extra "Regie" button on the field; the scene choice leads into the Regie window.
  assert.equal(await sl.locator('main button[aria-label="Regie öffnen"]').count(),0,name+': no Regie button top right');
  assert.equal(await pa.getByRole('button',{name:'Kontext öffnen'}).count(),1,'Players keep their context button');
  await sl.getByRole('button',{name:'Szenen des Abends',exact:true}).click();
  const choice=sl.locator('section',{has:sl.getByRole('heading',{level:2})}).filter({has:sl.getByRole('button',{name:/Regie öffnen|Nur privat lesen/})}).first();
  const sceneTitle=(await choice.getByRole('heading').textContent()).replace(/^\d\d/,'');
  const opened=gm.waitForEvent('page');await choice.getByRole('button',{name:/Regie öffnen|Nur privat lesen/}).click();
  const regie=watch(await opened,'Regie');await regie.waitForURL(/\/sl\/regie/);await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
  assert.equal(await sl.getByRole('complementary',{name:'Regie',exact:true}).count(),0,name+': no drawer opened on the table');
  await regie.getByRole('heading',{name:sceneTitle.trim()}).first().waitFor();
  pass(name+': scene choice opens the Regie window on that scene, no drawer, no top-right button');

  // 2. Persistent area menu: every area at once, last area survives reload.
  const menu=regie.getByRole('navigation',{name:'Bereiche der Szene'});
  for(const label of ['Erzählung','Atmosphäre','Dialoge','Interaktion','Geheimnisse','Folgen','SL-Notizen','Material','Ton & Musik','Effekte','NPCs','Pager','Tisch'])assert.ok(await menu.getByRole('button',{name:label,exact:true}).isVisible(),name+': menu '+label);
  await menu.getByRole('button',{name:'Geheimnisse',exact:true}).click();
  await regie.getByRole('region',{name:'Geheimnisse'}).waitFor();assert.equal(await menu.getByRole('button',{name:'Geheimnisse',exact:true}).getAttribute('aria-current'),'true');
  await menu.getByRole('button',{name:'Folgen',exact:true}).click();await regie.getByRole('region',{name:'Folgen'}).waitFor();
  await regie.reload();await regie.getByRole('region',{name:'Folgen'}).waitFor();
  assert.equal(await menu.getByRole('button',{name:'Folgen',exact:true}).getAttribute('aria-current'),'true',name+': last area survives reload');
  await menu.getByRole('button',{name:'Pager',exact:true}).click();await regie.waitForTimeout(900);
  const pagerBlock=await regie.locator('#regie-bereich-pager').boundingBox();const vp=regie.viewportSize();
  assert.ok(pagerBlock&&pagerBlock.y>=0&&pagerBlock.y<vp.height,name+': Pager area scrolled into view');
  for(const column of ['Material','Texte zum Vorlesen','Ton & Video','Spielfeld & Effekte'])assert.ok(await regie.getByRole('heading',{name:column,exact:true}).isVisible(),name+': column '+column);
  await noHorizontalScroll(regie,name+' Regie');
  await menu.getByRole('button',{name:'Erzählung',exact:true}).click();await regie.getByRole('region',{name:'Erzählung'}).waitFor();
  await regie.screenshot({path:output+'/'+name+'-regie.png'});
  pass(name+': area menu always visible, switches directly, remembers the last area');

  // 4. Pager to all while a media view covers the table: A and B get it on top, the GM sees the mirror.
  await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'showMedia',...room,eventId:crypto.randomUUID(),fileIds:[image.id],audience:{scope:'all'}}});
  await pa.getByRole('dialog',{name:'Gemeinsame Medienansicht'}).waitFor();await pb.getByRole('dialog',{name:'Gemeinsame Medienansicht'}).waitFor();
  const text='Ruf mich an · '+name+' · '+Date.now();
  await regie.getByLabel('Pager-Absender').fill('Schäfer');await regie.getByLabel('Pager-Titel').fill('Wichtig');await regie.getByLabel('Pager-Nachricht').fill(text);
  await regie.getByRole('button',{name:'Pager senden'}).click();
  for(const p of [pa,pb]){
   const pager=p.getByRole('region',{name:'Pager'});await pager.waitFor();
   await p.getByRole('dialog',{name:'Gemeinsame Medienansicht'}).waitFor({state:'hidden'});
   await p.getByRole('button',{name:'OK: öffnen oder quittieren'}).click();await pager.getByText(text).waitFor();
   assert.ok(await p.getByRole('button',{name:'Aktuelle Medien öffnen'}).isVisible(),'The media view stays reopenable');
  }
  const mirror=sl.getByRole('region',{name:'Pager-Spiegel'});await mirror.getByText(text).waitFor();
  assert.equal(await sl.locator('section[aria-label="Pager"] [aria-roledescription="Pager"]').count(),0,'The GM gets no player device (the mirror is read-only)');
  await pa.getByRole('button',{name:'OK: öffnen oder quittieren'}).click();await mirror.getByText('Gelesen 1/2: '+nameA).waitFor();
  await pa.screenshot({path:output+'/'+name+'-spieler-a-pager.png'});await sl.screenshot({path:output+'/'+name+'-sl-spiegel.png'});
  // A targeted pager: the mirror shows that it went out, never its content.
  const secret='Nur für A · '+Date.now();
  await regie.getByRole('group',{name:'Empfänger: Pager'}).getByRole('button',{name:nameA}).click();await regie.getByLabel('Pager-Nachricht').fill(secret);await regie.getByRole('button',{name:'Pager senden'}).click();
  await mirror.getByText('an '+nameA).first().waitFor();
  assert.equal(await sl.getByText(secret).count(),0,'Targeted pager text never on the shared GM table');
  await pb.waitForTimeout(1200);assert.equal(await pb.getByText(secret).count(),0,'B never gets the pager for A');
  pass(name+': pager reaches A and B over an open media view; GM mirror with read state; targeted text stays hidden');
  await calm();

  // 3. Atmosphere: fog visibly moves, new effects, soft fade, reduced motion calm.
  const fx=regie.getByRole('navigation',{name:'Bereiche der Szene'});await fx.getByRole('button',{name:'Effekte',exact:true}).click();
  for(const label of ['Nebel','Gewitter','Schnee','Funken & Glut','Dunkelheit','Flackerlicht'])await regie.getByRole('button',{name:label,exact:true}).click();
  for(const e of ['fog','storm','snow','embers','darkness','flicker'])await pa.locator('[data-effect='+e+']').waitFor({state:'attached'});
  const fog=pa.locator('[data-effect=fog] span').first();
  const t1=await fog.evaluate(e=>getComputedStyle(e).transform);await pa.waitForTimeout(1500);const t2=await fog.evaluate(e=>getComputedStyle(e).transform);
  assert.notEqual(t1,t2,name+': fog drifts');
  await pb.locator('[data-effect=storm]').waitFor({state:'attached'});
  assert.equal(await pb.locator('[data-effect=storm] span').last().evaluate(e=>getComputedStyle(e).display),'none','Reduced motion: no lightning');
  assert.equal(await pb.locator('[data-effect=fog] span').first().evaluate(e=>getComputedStyle(e).animationName),'none','Reduced motion: still fog');
  await pa.screenshot({path:output+'/'+name+'-effekte.png'});
  await regie.getByLabel('Überblenden: Wahl ersetzt laufende Effekte').check();await regie.getByRole('button',{name:'Regen',exact:true}).click();
  await pa.locator('[data-effect=fog][data-leaving]').waitFor({state:'attached'});await pa.locator('[data-effect=rain]').waitFor({state:'attached'});
  await pa.locator('[data-effect=fog]').waitFor({state:'detached'});
  pass(name+': fog wafts, six new/old effects, crossfade replaces softly, reduced motion stays calm');
  await calm();
  await Promise.all([gm.close(),a.close(),b.close()]);
 }

 // 5. Players at 375 px: the pager fits on a phone. (YouTube ambience: tests/ambiente-browser.mjs.)
 phase='375';
 const [gm,a]=await Promise.all([account('command-gm',viewports[1]),account('command-a',mobile)]);
 const regie=watch(await gm.newPage(),'Regie');await regie.goto(base+'/sl/regie');await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
 const pa=await table(a,'A375');
 const text='Pager 375 · '+Date.now();await regie.getByLabel('Pager-Nachricht').fill(text);await regie.getByRole('button',{name:'Pager senden'}).click();
 await pa.getByRole('region',{name:'Pager'}).waitFor();await pa.waitForTimeout(900);const pager=await pa.locator('[aria-roledescription="Pager"]').boundingBox();
 assert.ok(pager&&pager.x>=0&&pager.x+pager.width<=375+1,'Pager fits 375 px');await noHorizontalScroll(pa,'375 table');
 await pa.screenshot({path:output+'/375-pager.png'});
 pass('375: pager fits on a phone');
 await calm();
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: Regie-Nachbesserung im Browser');
}catch(e){console.error('FAIL in phase '+phase);throw e;}
finally{await browser.close();}
