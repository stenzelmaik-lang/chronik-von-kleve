import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {emptyScene} from '../domain/story-scene.ts';
import {htmlToRichText} from '../domain/location-rich-text.ts';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8902';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):8902$/,'Synthetic local fixture only');
const output=process.env.CVK_SCREENSHOTS||'.local-work/regie-studio';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});
const checks=[],errors=[];let page,phase='setup',writes=0;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
async function request(ctx,path,data,status=200){const r=await ctx.request.fetch(base+path,{method:data?'POST':'GET',headers:{Origin:base},...(data?{data}:{})});const body=await r.json();assert.equal(r.status(),status,path+' '+JSON.stringify(body).slice(0,220));return body;}
async function login(id){const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await request(ctx,'/api/auth/login',{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'});return ctx;}
try{
 const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
 const active=await request(gm,'/api/live-table?view=active');assert.ok(active.room?.started&&active.room.title.startsWith('SYNTHETISCH'));
 const q='/api/live-stage?sessionId='+active.room.sessionId,snapshot=await request(gm,q+'&catalog=1');
 const elementId=randomUUID(),stamp=randomUUID().slice(0,6),title='SYNTHETISCH Regie-Studio '+stamp,materialTitle='SYNTHETISCH Brief '+stamp;
 const document={...emptyScene(),title,narration:htmlToRichText('<h2>Eine Tür im Regen</h2><p>Ein <strong>Vorlesetext</strong> mit <em>erhaltener Formatierung</em>.</p>'),
  dialogueNotes:htmlToRichText('<h2>Dialog am Tresen</h2><p class="speaker">Die Wirtin</p>'+Array.from({length:60},(_,i)=>'<p>Dialogabsatz '+i+': Ihr kommt spät. Draußen wartet die Stadt, und hier drinnen hört jemand mit.</p>').join('')+'<table><tr><th>Person</th><th>Hinweis</th></tr><tr><td>Wirtin</td><td>Nur für die Regie</td></tr></table>'),
  atmosphere:'SYNTHETIC_PRIVATE_ATMOSPHERE',secrets:'SYNTHETIC_STUDIO_SECRET',
  youtube:[{id:randomUUID(),title:'Test-Titel 1',videoId:'l8GAZU4eY7g'},{id:randomUUID(),title:'Test-Titel 2',videoId:'dQw4w9WgXcQ'}],
  elements:[{id:elementId,kind:'handout',title:materialTitle,text:'SYNTHETIC_RECIPIENT_A_ONLY',referenceId:'',fileId:'',material:{type:'letter',files:[],assetId:'',display:'single',note:'',effect:{open:'fade',close:'fade',speed:'normal',soundFileId:'',afterClose:'closed'}}}]};
 const scene=(await request(gm,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document},201)).scene;
 const empty=(await request(gm,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document:{...emptyScene(),title:'SYNTHETISCH leere Regie '+stamp}},201)).scene;
 const layoutKey='chroniplay:regie-layout:chronik-von-kleve:'+snapshot.principal.id;
 await gm.addInitScript(({layoutKey,runId,sceneId,actorId})=>{if(sessionStorage.getItem('studio-seeded'))return;sessionStorage.setItem('studio-seeded','1');localStorage.setItem(layoutKey,JSON.stringify({order:['narration','dialogue','atmosphere','Szenenmaterial','material'],hidden:['Szenenmaterial'],wide:['Szenenmaterial','Hintergrundmusik']}));localStorage.setItem('chroniplay:regie:'+runId,JSON.stringify({sceneId}));localStorage.setItem('chroniplay:regie-bereich:'+actorId,'narration');},{layoutKey,runId:active.room.runId,sceneId:scene.id,actorId:snapshot.principal.id});
 page=await gm.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/live-stage')writes++;});
 await page.goto(base+'/sl/regie');await page.locator('[data-regie-studio]').waitFor();await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(scene.id);
 const nav=page.getByRole('navigation',{name:'Arbeitsansichten der Regie'}),quick=page.getByRole('region',{name:'Schnellwerkzeuge'});
 const pane=id=>page.locator('[data-area="'+id+'"]'),body=id=>pane(id).locator('[tabindex="0"]');
 await pane('narration').getByText('Eine Tür im Regen',{exact:true}).waitFor();
 for(const label of ['Szene führen','Interaktion','Stimmung','Proben & NPCs','Spieler am Tisch','Tischblick','Tastenkürzel'])
  await nav.getByRole('button',{name:label,exact:true}).waitFor();
 assert.equal(await pane('narration').locator('strong').filter({hasText:'Vorlesetext'}).count(),1);
 await page.getByRole('button',{name:'Dialoge',exact:true}).click();await pane('dialogue').getByText('Dialog am Tresen',{exact:true}).waitFor();
 assert.equal(await pane('dialogue').locator('table').count(),1);await body('dialogue').evaluate(el=>{el.scrollTop=750;});const readAt=await body('dialogue').evaluate(el=>el.scrollTop);assert.ok(readAt>600);
 const topParagraph=()=>body('dialogue').evaluate(el=>[...el.querySelectorAll('p')].find(p=>p.getBoundingClientRect().bottom>el.getBoundingClientRect().top+4)?.textContent);const readingParagraph=await topParagraph();
 await quick.getByRole('button',{name:/^Material/}).click();await pane('Szenenmaterial').getByText(materialTitle,{exact:true}).waitFor();assert.equal(await pane('Szenenmaterial').getAttribute('data-wide'),'true');assert.equal(await topParagraph(),readingParagraph,'Reader anchors the same paragraph when the drawer changes line wrapping');
 assert.equal(writes,0,'Navigation and restoring hidden modules never publishes');await page.screenshot({path:output+'/dialogue-material.png'});await page.keyboard.press('Escape');assert.equal(await pane('Szenenmaterial').isVisible(),false);assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);
 pass('Neues Layout, vorhandene HTML-Formatierung, alte Breitenpräferenz und Material-Schuber ohne Freigabe oder Verlust der Lesestelle');

 phase='material recipients';await quick.getByRole('button',{name:/^Material/}).click();const card=page.locator('[data-material="'+elementId+'"]'),nameA=snapshot.crew.find(p=>p.id==='command-a').name;
 await card.getByRole('group',{name:'Empfänger: '+materialTitle}).getByRole('button',{name:nameA,exact:true}).click();await card.getByRole('button',{name:'Freigeben · '+nameA,exact:true}).click();await card.getByText('Freigegeben · '+nameA,{exact:true}).waitFor();
 const object=(await request(gm,q)).objects.find(o=>o.title===materialTitle);assert.deepEqual(object.recipients,['command-a']);assert.ok((await request(a,q)).objects.some(o=>o.id===object.id));assert.ok(!(await request(b,q)).objects.some(o=>o.id===object.id));
 await page.keyboard.press('Escape');assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);pass('Vorhandenes Szenenmaterial wird über die echte API nur für die gewählte Person freigegeben');

 phase='effect';await quick.getByRole('button',{name:/^Effekte/}).click();const fog=pane('effects').getByRole('button',{name:'Nebel',exact:true});if(await fog.getAttribute('aria-pressed')==='true')await fog.click();await fog.click();await fog.locator('xpath=.').waitFor();await page.waitForFunction(()=>document.querySelector('[data-area="effects"] button[aria-pressed="true"]'));
 assert.ok((await request(a,q)).effects.includes('fog'));await page.screenshot({path:output+'/effects.png'});await page.keyboard.press('Escape');assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);pass('Effekt tatsächlich am Tisch aktivieren und an derselben Dialogstelle weiterlesen');

 phase='pager draft';await quick.getByRole('button',{name:/^Pager/}).click();const pager=pane('Pager · spontan');await pager.getByLabel('Pager-Titel',{exact:true}).fill('SYNTHETISCH Pager '+stamp);await pager.getByLabel('Pager-Nachricht',{exact:true}).fill('SYNTHETIC_STUDIO_PAGER_ONLY_A');await pager.getByRole('group',{name:'Empfänger: Pager',exact:true}).getByRole('button',{name:nameA,exact:true}).click();
 await page.keyboard.press('Escape');await quick.getByRole('button',{name:/^Pager/}).click();assert.equal(await pager.getByLabel('Pager-Nachricht',{exact:true}).inputValue(),'SYNTHETIC_STUDIO_PAGER_ONLY_A');await pager.getByRole('button',{name:'Pager senden',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Gesendete Pager"]')?.textContent.includes('SYNTHETIC_STUDIO_PAGER_ONLY_A'));
 const sent=(await request(gm,q)).pagers.find(p=>p.text==='SYNTHETIC_STUDIO_PAGER_ONLY_A');assert.deepEqual(sent.recipients,['command-a']);assert.ok(!(await request(b,q)).pagers.some(p=>p.id===sent.id));await page.keyboard.press('Escape');pass('Pager-Entwurf und Empfänger bleiben erhalten; echte Zustellung wahrt die Empfängergrenze');

 phase='focus';await pane('dialogue').getByRole('button',{name:'Dialoge im Vollbild öffnen',exact:true}).click();assert.ok(await pane('dialogue').evaluate(el=>el.getBoundingClientRect().width>innerWidth-10));await page.screenshot({path:output+'/focus.png'});
 await page.keyboard.press('Alt+e');await pane('effects').waitFor({state:'visible'});await page.keyboard.press('Escape');assert.ok(await page.locator('[data-regie-studio]').getAttribute('data-focus')==='true');await page.keyboard.press('Escape');assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);
 await pane('dialogue').getByRole('button',{name:'Dialoge breiter anzeigen',exact:true}).click();assert.equal(await pane('dialogue').getAttribute('data-wide'),'true');await pane('dialogue').getByRole('button',{name:'Dialoge breiter anzeigen',exact:true}).click();pass('Arbeitsfläche im Lesefokus, Schnellwerkzeuge aus dem Fokus und reversible breite Ansicht');

 phase='all workspaces';await nav.getByRole('button',{name:'Interaktion',exact:true}).click();await page.getByRole('button',{name:'Spontanmaterialien',exact:true}).click();await pane('material').waitFor({state:'visible'});await page.getByRole('button',{name:'Visionen & Briefe',exact:true}).click();await pane('whispers').waitFor({state:'visible'});
 await nav.getByRole('button',{name:'Stimmung',exact:true}).click();await page.getByRole('button',{name:'Hintergrundmusik',exact:true}).click();await pane('music').waitFor({state:'visible'});assert.equal(await pane('music').getAttribute('data-wide'),'true','Legacy title-based preference is migrated');
 await nav.getByRole('button',{name:/Proben & NPCs/}).click();await page.getByRole('button',{name:'Standardfiguren & Würfel',exact:true}).click();const figures=pane('figures');await figures.waitFor({state:'visible'});await figures.getByRole('button',{name:'Standardfiguren im Vollbild öffnen',exact:true}).click();assert.ok(await figures.evaluate(el=>el.getBoundingClientRect().width>innerWidth-10));await page.screenshot({path:output+'/figures-focus.png'});await page.keyboard.press('Escape');
 await nav.getByRole('button',{name:'Spieler am Tisch',exact:true}).click();
 await page.getByRole('button',{name:'Spieler & Charaktere',exact:true}).click();
 await pane('players').getByRole('button',{name:'Charakterbogen',exact:true}).first().waitFor();
 await nav.getByRole('button',{name:'Tischblick',exact:true}).click();await pane('table').getByRole('listitem').filter({hasText:materialTitle}).waitFor();await page.screenshot({path:output+'/table.png'});await nav.getByRole('button',{name:'Szene führen',exact:true}).click();assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);pass('Alle vorhandenen Werkzeuge sind gruppiert erreichbar, Tabelle nutzt Vollbild, Tischblick zeigt echte Freigaben');

 phase='reload and empty';await page.reload();await pane('dialogue').waitFor({state:'visible'});assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(empty.id);await quick.getByRole('button',{name:/^Material/}).click();await pane('Szenenmaterial').getByText('Für diese Szene ist noch kein Szenenmaterial vorbereitet.',{exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(scene.id);await pane('dialogue').waitFor({state:'visible'});assert.equal(await body('dialogue').evaluate(el=>el.scrollTop),readAt);pass('Lesestelle bleibt nach Neuladen und Szenenwechsel erhalten; leere Szene hat einen klaren Material-Leerzustand');

 phase='responsive';await page.getByRole('button',{name:'Erzählung',exact:true}).click();await page.screenshot({path:output+'/desktop.png'});
 for(const width of [1024,834,390,320]){await page.setViewportSize({width,height:width<500?844:1000});
  await page.waitForFunction(()=>{const bar=document.querySelector('[aria-label="Schnellwerkzeuge"]')?.getBoundingClientRect();return bar&&bar.top>=0&&bar.bottom<=innerHeight+1;},undefined,{timeout:3000});
  const tools=await quick.boundingBox();assert.ok(tools&&tools.y>=0&&tools.y+tools.height<=page.viewportSize().height+1,'Quick tools remain inside viewport at '+width);
  if(width<=390){const start=await page.getByRole('button',{name:'Szene starten',exact:true}).boundingBox(),layout=await page.getByLabel('Layout einstellen',{exact:true}).boundingBox();assert.ok(start&&layout&&start.x+start.width<=layout.x,'Start and layout controls must not overlap at '+width);}
  await quick.getByRole('button',{name:/^Material/}).click();await pane('Szenenmaterial').getByText(materialTitle,{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow at '+width);const close=pane('Szenenmaterial').getByRole('button',{name:'Werkzeug schließen und Text fortsetzen'});const closeBox=await close.boundingBox();assert.ok(closeBox&&closeBox.y>=0&&closeBox.y+closeBox.height<=page.viewportSize().height,'Drawer close remains visible');if(width===390)await page.screenshot({path:output+'/mobile-drawer-390.png'});await close.click();await pane('narration').getByText('Eine Tür im Regen',{exact:true}).waitFor();assert.ok((await body('narration').boundingBox()).height>=190,'Usable reading height at '+width);if(width===390)await page.screenshot({path:output+'/mobile-390.png'});if(width===834)await page.screenshot({path:output+'/tablet-834.png'});if(width===320)await page.screenshot({path:output+'/mobile-320.png'});}
 pass('Desktop, Tablet-Viewport, 390 und 320 px: Werkzeuge und Rückkehr erreichbar, kein Seitenüberlauf');

 phase='permissions';await request(a,q+'&regie='+scene.id,undefined,403);const playerPage=await a.newPage();await playerPage.goto(base+'/sl/regie');assert.equal(await playerPage.locator('[data-regie-studio]').count(),0);assert.ok(!(await playerPage.content()).includes('SYNTHETIC_STUDIO_SECRET'));assert.deepEqual(errors,[]);pass('Spieler erhalten weder Regie noch private Szeneninhalte; keine JavaScript-Seitenfehler');

 phase='table withdrawal';
 await nav.getByRole('button',{name:'Tischblick',exact:true}).click();
 await pane('table').getByRole('button',{name:materialTitle+' vom Tisch nehmen',exact:true}).click();
 await pane('table').getByRole('listitem').filter({hasText:materialTitle}).waitFor({state:'detached'});
 assert.ok(!(await request(a,q)).objects.some(o=>o.id===object.id));
 pass('Tischblick nimmt das freigegebene Material auch vom Spielertisch');

 phase='quick music and scene change';
 await page.setViewportSize({width:1440,height:1000});
 await a.route(/https:\/\/[^/]*(?:youtube|ytimg)\.[^/]+\//,route=>route.abort());
 await playerPage.goto(base+'/spielbereich?bereich=sitzung');
 const tableMusic=playerPage.getByRole('group',{name:'Hintergrundmusik',exact:true}),ambience=playerPage.getByLabel('Ambiente-Musik',{exact:true});
 const music=quick.getByRole('group',{name:'Musik am Tisch'}),musicMenu=page.getByRole('dialog',{name:'Musiksteuerung'}),stop=music.getByRole('button',{name:'Musik für alle stoppen'});
 const selectScene=id=>page.getByLabel('Szene in der Regie',{exact:true}).selectOption(id);
 const startScene=()=>page.getByRole('button',{name:'Szene starten',exact:true}).click();
 const chooseFile=async()=>{
  await music.getByRole('button').first().click();
  await musicMenu.getByRole('listitem').filter({hasText:'Regennacht – Hintergrundmusik'}).getByRole('button',{name:'Als Musik',exact:true}).click();
  await page.keyboard.press('Escape');
  await tableMusic.waitFor();
 };
 await startScene();await ambience.waitFor();await chooseFile();
 const audio=await tableMusic.locator('audio').elementHandle();
 if(await audio.evaluate(el=>el.paused))await tableMusic.getByRole('button',{name:'Musik abspielen',exact:true}).click();
 await playerPage.waitForFunction(el=>!el.paused,audio);
 const beforeSelect=writes;await selectScene(empty.id);await page.locator('main[data-scene="'+empty.id+'"]').waitFor();
 assert.equal(writes,beforeSelect,'Selecting a scene for reading sends no command');
 assert.equal(await audio.evaluate(el=>el.paused),false);
 await startScene();await tableMusic.waitFor({state:'detached'});await ambience.waitFor({state:'detached'});
 assert.equal(await audio.evaluate(el=>el.paused),true,'The old audio element is paused on removal');
 assert.equal((await request(a,q)).music,null);assert.equal((await request(a,q)).youtube,null);
 await selectScene(scene.id);await startScene();await ambience.waitFor();
 await music.getByRole('button').first().click();await musicMenu.getByRole('button',{name:'Playlist ab Titel 2 starten'}).click();
 await musicMenu.getByText('Test-Titel 2',{exact:true}).waitFor();assert.equal((await request(a,q)).youtube.index,1);
 await page.keyboard.press('Escape');await chooseFile();await stop.click();
 await tableMusic.waitFor({state:'detached'});await ambience.waitFor({state:'detached'});assert.equal(await stop.isDisabled(),true);
 pass('Szenenauswahl spielt weiter, Szenenstart ohne Musik stoppt beide Quellen, Schnellmenü wählt Titel und stoppt die Musik für alle');

 phase='effects quick menu';
 const effectsMenu=page.getByRole('dialog',{name:'Tischeffekte'});
 await quick.getByRole('button',{name:'Nebel',exact:true}).click();await effectsMenu.getByRole('button',{name:'Alle beenden',exact:true}).click();
 await quick.getByRole('button',{name:'Keine Effekte',exact:true}).waitFor();await page.keyboard.press('Escape');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width<500?844:1000});
  await quick.getByRole('button',{name:'Keine Effekte',exact:true}).click();
  await page.waitForFunction(()=>{
   const menu=document.querySelector('[role="dialog"][aria-label="Tischeffekte"]')?.getBoundingClientRect();
   return menu&&menu.width>0&&menu.left>=-1&&menu.top>=-1&&menu.right<=innerWidth+1&&menu.bottom<=innerHeight+1;
  },undefined,{timeout:3000});
  if(width===390)await page.screenshot({path:output+'/effects-390.png'});
  await page.keyboard.press('Escape');await effectsMenu.waitFor({state:'hidden'});
 }
 await page.setViewportSize({width:1440,height:1000});
 await quick.getByRole('button',{name:'Keine Effekte',exact:true}).click();
 for(const [label,id] of [['Mondlicht','moonlight'],['Kerzenschein','candlelight'],['Rituallicht','ritualglow']]){
  await effectsMenu.getByRole('button',{name:label,exact:true}).click();
  const layer=playerPage.locator('[data-effect="'+id+'"]:not([data-leaving])');await layer.waitFor();
  assert.equal(await layer.locator('span').evaluate(el=>getComputedStyle(el).animationName),'none');
 }
 await page.screenshot({path:output+'/effects-quick.png'});
 await effectsMenu.getByRole('button',{name:'Alle beenden',exact:true}).click();await quick.getByRole('button',{name:'Keine Effekte',exact:true}).waitFor();
 await page.keyboard.press('Escape');await playerPage.locator('[data-effect]').first().waitFor({state:'detached'});
 pass('Effekte öffnen direkt in der unteren Leiste, bleiben auf kleinen Ansichten erreichbar und kommen ohne Bewegung beim Spieler an');

 phase='condition controls';
 await nav.getByRole('button',{name:'Spieler am Tisch',exact:true}).click();await page.getByRole('button',{name:'Zustände',exact:true}).click();
 const vitals=pane('vitals'),rules=page.getByRole('dialog',{name:'Rundenregeln'});
 const originalDamage=(await request(gm,q)).vitals.damageBy;
 await vitals.getByRole('button',{name:'Rundenregeln',exact:true}).click();
 await rules.getByLabel('Wer trägt Schaden ein').selectOption(originalDamage==='sl'?'player':'sl');
 await page.getByText('Schadensrecht geändert.',{exact:true}).waitFor();assert.notEqual((await request(gm,q)).vitals.damageBy,originalDamage);
 await rules.getByLabel('Wer trägt Schaden ein').selectOption(originalDamage);await page.keyboard.press('Escape');
 await vitals.getByRole('button',{name:'Neue Nacht',exact:true}).click();const night=vitals.getByRole('group',{name:'Neue Nacht bestätigen'});
 await night.getByRole('button',{name:'Abbrechen',exact:true}).click();await night.waitFor({state:'hidden'});
 await page.route(url=>url.pathname==='/api/live-stage'&&!url.searchParams.has('regie'),async route=>{
  if(route.request().method()!=='GET')return route.continue();
  const response=await route.fetch(),json=await response.json();
  if(json.vitals?.characters.length){const sample=json.vitals.characters[0];json.vitals.characters=Array.from({length:10},(_,i)=>({...sample,id:'layout-'+i,title:'Testfigur '+(i+1),ownerName:'Testspieler '+(i+1)}));}
  await route.fulfill({response,json});
 });
 await page.setViewportSize({width:1920,height:1080});
 const cards=vitals.locator('[data-vitals-character]');await cards.nth(9).waitFor({state:'attached'});
 const columns=()=>cards.evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().x))).size);
 assert.ok(await columns()>=4);await page.screenshot({path:output+'/vitals-1920.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await columns(),1);
 await page.unrouteAll({behavior:'wait'});
 pass('Rundenregeln greifen serverseitig, Nachtwechsel lässt sich abbrechen, zehn Zustandskarten verteilen sich auf dem großen Bildschirm und stapeln bei 390 px');

 assert.deepEqual(errors,[]);
 writeFileSync(output+'/result.json',JSON.stringify({checks,errors,stageWrites:writes,sceneId:scene.id},null,2));console.log('ALL PASS: '+checks.length+' Regie-Studio workflows');
}catch(error){console.error('FAILED PHASE '+phase);if(page)await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
