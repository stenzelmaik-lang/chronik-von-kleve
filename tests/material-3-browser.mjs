import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Spielmaterial 3.0 in real browsers (desktop 1440 and a 375 px touch phone) against scripts/start-material-3.ps1:
// material overview, editor flow, private test, Regie release to one player, personal paging per viewer,
// withdrawal and the absence of any publication from private previews.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8893'].includes(new URL(base).port),'Use the isolated synthetic material fixture only');
const output='.local-work/ux-check/material-3';mkdirSync(output,{recursive:true});
const viewports=[{name:'desktop',viewport:{width:1440,height:900}},{name:'mobile',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true}];
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='setup';
const pass=label=>console.log('PASS '+phase+' · '+label);
async function account(id,options){const context=await browser.newContext(options);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
const noHorizontalScroll=async(p,label)=>{const [w,inner]=await p.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);assert.ok(w<=inner+1,label+': no horizontal page scroll ('+w+' > '+inner+')');};
let setup,room;
const state=async()=>(await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();
async function clearMaterials(){
 let s=await state();
 for(const o of s.objects.filter(o=>o.kind!=='note'&&String(o.sourceId).startsWith('scene-material:'))){const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:s.version,command:{action:'remove',id:o.id}}});assert.equal(r.status(),200);s=await state();}
}
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const initial=await state();
 if(initial.media&&!initial.media.hidden)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',...room,eventId:initial.media.id,audience:{scope:'all'}}});
 if(initial.sceneEventId)await setup.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',...room,eventId:initial.sceneEventId,audience:{scope:'all'}}});
 const catalog=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId)+'&catalog=1')).json();
 const kaserne=catalog.scenes.find(s=>s.title.includes('Kaserne')).id;
 const nameA=catalog.crew.find(m=>m.id==='command-a').name;
 if(catalog.stageSceneId!==kaserne){const r=await setup.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{...room,expectedVersion:catalog.version,command:{action:'activateScene',sceneId:kaserne}}});assert.equal(r.status(),200);}
 await clearMaterials();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'})]);

  // Material overview and editor flow.
  const prep=watch(await gm.newPage(),name+' prep');
  await prep.goto(base+'/sl/command-center?bereich=vorbereitung&material=szenen&szene='+encodeURIComponent(kaserne));
  await prep.getByRole('heading',{name:'Interaktionen & Spielmaterial'}).waitFor();
  const cards=prep.locator('[data-material-card]');
  assert.ok(await cards.count()>=12,'materials and legacy media as cards ('+await cards.count()+')');
  await prep.getByLabel('Material suchen').fill('Anselmus');
  assert.equal(await cards.count(),2,'search finds packet and letter');
  await prep.getByLabel('Material suchen').fill('');
  await prep.getByLabel('Nach Art filtern').selectOption('dossier');
  assert.equal(await cards.count(),1,'type filter');
  await prep.getByLabel('Nach Art filtern').selectOption('all');
  await prep.locator('[data-material-card]',{hasText:'Verschollener Umschlag'}).getByText(/Darstellung fehlt/).waitFor();
  assert.doesNotMatch(await prep.locator('[data-material-card]',{hasText:'Anselmus-Paket'}).innerText(),/Effekt-Ersatz/,'complete asset has no fallback');
  await prep.getByRole('button',{name:'Material hinzufügen'}).click();
  assert.equal(await prep.getByRole('region',{name:'Art des Materials wählen'}).getByRole('button').filter({hasText:/./}).count(),8,'eight material types');
  await prep.getByRole('button',{name:'Auswahl schließen'}).click();
  await noHorizontalScroll(prep,name+' overview');
  await prep.screenshot({path:output+'/'+name+'-overview.png',fullPage:false});
  pass('overview: cards, search, filter, type-first add');
  const before=(await state()).version;
  await prep.locator('[data-material-card]',{hasText:'Anselmus-Paket'}).getByRole('button',{name:'Bearbeiten',exact:true}).click();
  await prep.getByRole('list',{name:'Dateien in fester Reihenfolge'}).waitFor();
  assert.equal(await prep.getByRole('list',{name:'Dateien in fester Reihenfolge'}).locator('li').count(),6);
  await prep.getByRole('button',{name:/Gestaltung/}).click();
  await prep.getByText('Paketumschlag mit Siegel').first().waitFor();
  await prep.getByRole('button',{name:/Verhalten & Effekte/}).click();
  assert.equal(await prep.getByRole('radio',{name:/Entsiegeln/}).getAttribute('aria-checked'),'true');
  await prep.getByRole('button',{name:/Vorschau/}).first().click();
  await prep.getByRole('button',{name:'Privat testen'}).click();
  const test=prep.getByRole('dialog',{name:'Material: Anselmus-Paket'});
  await test.getByRole('button',{name:/Öffnen/}).click();
  await test.getByText('Bild 1 von 6').waitFor();
  await test.getByRole('button',{name:'Nächstes Bild'}).click();
  await test.getByText('Bild 2 von 6').waitFor();
  await noHorizontalScroll(prep,name+' private test');
  await prep.screenshot({path:output+'/'+name+'-private-test.png'});
  await test.getByRole('button',{name:'Schließen (nur für mich)'}).click();
  await test.waitFor({state:'hidden'});
  assert.equal((await state()).version,before,'a private test changes nothing on the table');
  await prep.getByRole('button',{name:'Zur Übersicht'}).click();
  pass('editor flow and private test with real assets, nothing published');

  // Regie: release the packet to Player A only; Player B sees nothing.
  const regie=watch(await gm.newPage(),name+' regie');
  await regie.goto(base+'/sl/regie');
  const item=regie.locator('[data-material]',{hasText:'Anselmus-Paket'});
  await item.waitFor();
  await item.getByRole('button',{name:'Privat ansehen',exact:true}).click();
  const privateView=regie.getByRole('dialog',{name:'Material: Anselmus-Paket'});
  await privateView.getByText(/Private Vorschau/).waitFor();
  await privateView.getByRole('button',{name:'Schließen (nur für mich)'}).click();
  assert.equal((await state()).objects.some(o=>o.title==='Anselmus-Paket'),false,'private view publishes nothing');
  await item.getByRole('button',{name:nameA,exact:true}).click();
  await item.getByRole('button',{name:'Freigeben · '+nameA}).click();
  await item.getByText('Freigegeben · '+nameA).waitFor();
  await regie.screenshot({path:output+'/'+name+'-regie.png'});
  pass('Regie: private view, then release to Player A');
  // Every other type opens and closes in its own presentation (test 1, 4, 5 and the letter with the reused envelope).
  for(const [title,selector] of [['Foto: Brücke im Nebel','img'],['Tonband: Verhör','audio'],['Überwachungsband','video'],['Brief an Anselmus','article']]){
   const entry=regie.locator('[data-material]',{hasText:title});
   await entry.getByRole('button',{name:'Privat ansehen',exact:true}).click();
   const d=regie.getByRole('dialog',{name:'Material: '+title});
   const opener=d.getByRole('button',{name:/Öffnen/});
   if(await opener.count())await opener.click();
   await d.locator(selector).first().waitFor({state:'attached'});
   await noHorizontalScroll(regie,name+' '+title);
   if(title==='Überwachungsband')await regie.screenshot({path:output+'/'+name+'-video.png'});
   await d.getByRole('button',{name:'Schließen (nur für mich)'}).click();
   await d.waitFor({state:'detached'});
  }
  pass('image, audio, video and letter open and close privately');
  const [pa,pb]=await Promise.all([table(a,name+' A'),table(b,name+' B')]);
  const tokenA=pa.getByRole('button',{name:'Anselmus-Paket öffnen'});
  await tokenA.waitFor();
  assert.equal(await pb.getByRole('button',{name:'Anselmus-Paket öffnen'}).count(),0,'Player B sees nothing');
  await tokenA.click();
  const viewA=pa.getByRole('dialog',{name:'Material: Anselmus-Paket'});
  await viewA.getByRole('button',{name:/Öffnen/}).click();
  await viewA.getByText('Bild 1 von 6').waitFor();
  await viewA.getByRole('button',{name:'Nächstes Bild'}).click();await viewA.getByRole('button',{name:'Nächstes Bild'}).click();
  await viewA.getByText('Bild 3 von 6').waitFor();
  await noHorizontalScroll(pa,name+' player view');
  await pa.screenshot({path:output+'/'+name+'-player-a.png'});
  await viewA.getByRole('button',{name:'Schließen (nur für mich)'}).click();
  pass('Player A opens the packet with its effect and pages personally');

  // Release to everyone: B starts on page 1, A keeps page 3 (personal viewer state).
  await item.getByRole('button',{name:'Alle',exact:true}).click();
  await item.getByRole('button',{name:/Freigabe ändern · alle/}).click();
  await item.getByText('Freigegeben · ganze Runde').waitFor();
  const tokenB=pb.getByRole('button',{name:'Anselmus-Paket öffnen'});
  await tokenB.waitFor();await tokenB.click();
  const viewB=pb.getByRole('dialog',{name:'Material: Anselmus-Paket'});
  await viewB.getByRole('button',{name:/Öffnen/}).click();
  await viewB.getByText('Bild 1 von 6').waitFor();
  await tokenA.click();await viewA.getByRole('button',{name:/Öffnen/}).click();
  await viewA.getByText('Bild 3 von 6').waitFor();
  await viewA.getByRole('button',{name:'Schließen (nur für mich)'}).click();
  pass('each player pages independently');

  // Withdraw: the open view of B closes and the token disappears.
  await item.getByRole('button',{name:'Zurückziehen'}).click();
  await tokenB.waitFor({state:'detached',timeout:20000});
  await viewB.waitFor({state:'detached',timeout:20000});
  assert.equal(await pa.getByRole('button',{name:'Anselmus-Paket öffnen'}).count(),0);
  pass('withdrawal closes the material for players');
  await clearMaterials();
  await Promise.all([gm.close(),a.close(),b.close()]);
 }
 assert.deepEqual(errors,[],'no page errors');
 console.log('Spielmaterial 3.0 browser: all checks passed. Screenshots in '+output);
}finally{await browser.close();}
