import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Visions & personal messages (Alpha 2.0) in real browsers: GM Regie plus two separate players at the same table.
// Synthetic --regie fixture only. Screenshots go to artifacts/live-deliveries (not versioned).
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8870';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Synthetic local instances only');
const out='artifacts/live-deliveries';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const errors=[];let step='setup';
const ok=msg=>console.log('PASS BROWSER '+msg);
async function account(id,viewport={width:1440,height:900}){const c=await browser.newContext({viewport,locale:'de-DE'});const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(r.status(),200);return c;}
const api=async(c,path,data)=>{const r=await c.request.fetch(base+path,{method:data?'POST':'GET',headers:{Origin:base},...(data?{data}:{})});return {status:r.status(),data:await r.json().catch(()=>null)};};
try{
 const gmc=await account('command-gm'),ac=await account('command-a',{width:1280,height:800}),bc=await account('command-b',{width:390,height:844});
 const room=(await api(gmc,'/api/live-table?view=active')).data.room,sessionId=room.sessionId;
 const snap=(await api(gmc,'/api/live-stage?sessionId='+encodeURIComponent(sessionId)+'&catalog=1')).data;
 const sceneId=snap.stageSceneId||snap.scenes[0].id,images=snap.catalog.filter(f=>f.sourceKind==='file'&&f.mime?.startsWith('image/')).slice(0,2).map(f=>f.id);
 let scene=(await api(gmc,'/api/command-center/scenes?id='+sceneId)).data.scene;
 const vision=(preset,title,extra={})=>({id:crypto.randomUUID(),kind:'vision',title,text:'',recipientIds:['command-a'],fileIds:[],preset,fragments:[title+': Etwas regt sich hinter dem Schleier.','Du erinnerst dich an diesen Ort.'],...extra});
 const v={classic:vision('classic','Klassisch',{fileIds:images}),dream:vision('dream','Traum'),dark:vision('dark','Dunkel',{fileIds:images.slice(0,1)}),threat:vision('threat','Bedrohung',{recipientIds:[]}),drama:vision('drama','Offenbarung'),echo:vision('echo','Echo',{fileIds:images.slice(1)})};
 const fax={id:crypto.randomUUID(),kind:'letter',title:'Fax intern',text:'cvk-html-v1:<p>Treffen um Mitternacht am Bahnhof. Kommen Sie allein.</p>',recipientIds:['command-b'],fileIds:[],layout:'fax',sender:'Kanzlei Vogt'};
 const saved=await api(gmc,'/api/command-center/scenes',{action:'save',id:sceneId,version:scene.version,document:{...scene.document,whispers:[...Object.values(v),fax]}});
 assert.equal(saved.status,200,JSON.stringify(saved.data));scene=saved.data.scene;
 const runsCount=async()=>(await api(gmc,'/api/live-deliveries?sessionId='+encodeURIComponent(sessionId))).data.runs.length;
 const before=await runsCount();

 step='editor: own gallery sections, no inline gallery, tempo, sounds';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const wav=(()=>{const w=Buffer.alloc(444);w.write('RIFF',0);w.writeUInt32LE(436,4);w.write('WAVE',8);w.write('fmt ',12);w.writeUInt32LE(16,16);w.writeUInt16LE(1,20);w.writeUInt16LE(1,22);w.writeUInt32LE(8000,24);w.writeUInt32LE(16000,28);w.writeUInt16LE(2,32);w.writeUInt16LE(16,34);w.write('data',36);w.writeUInt32LE(400,40);return w;})();
 const ed=await gmc.newPage();ed.on('pageerror',e=>errors.push('Editor: '+e.message));
 await ed.goto(base+'/sl/command-center?bereich=sitzung&scene='+encodeURIComponent(sceneId)+'&section=visions');
 const prep=ed.getByRole('region',{name:'Visionen und persönliche Botschaften vorbereiten'});await prep.waitFor({timeout:30000});
 const entries=prep.getByRole('list',{name:'Vorbereitete persönliche Inhalte'});
 await entries.getByRole('button',{name:/^Klassisch(?! nach)/}).click();
 assert.equal(await prep.getByRole('button',{name:'Galerie',exact:true}).count(),0,'no general gallery inside the vision text');
 assert.equal(await prep.getByRole('button',{name:'Weitere Formatierung'}).count(),0,'no formatting switch');
 const media=prep.getByRole('region',{name:'Bilder aus der Galerie Visionen'});
 await media.locator('input[type=file]').setInputFiles({name:'SYNTH-erscheinung.png',mimeType:'image/png',buffer:png});
 await media.getByRole('button',{name:'Bild abwählen: SYNTH-erscheinung.png'}).waitFor({timeout:15000});ok('a picture uploaded at the vision lands in the own gallery "Visionen" and is attached');
 await prep.getByRole('radio',{name:'Zügig'}).check();
 await prep.getByRole('region',{name:'Inszenierung'}).locator('input[type=file]').setInputFiles({name:'SYNTH-ton.wav',mimeType:'audio/wav',buffer:wav});
 await ed.waitForFunction(()=>[...document.querySelectorAll('select')].some(s=>s.selectedOptions[0]?.textContent==='SYNTH-ton.wav'),null,{timeout:15000});ok('an own sound is uploaded and chosen for the vision; tempo set to brisk');
 await ed.screenshot({path:out+'/editor-vision-gallery.png',fullPage:true});
 const filesNow=(await api(gmc,'/api/files')).data.files;
 assert.equal(filesNow.find(f=>f.name==='SYNTH-erscheinung.png')?.section,'visionen');assert.equal(filesNow.find(f=>f.name==='SYNTH-ton.wav')?.section,'visionen');
 await entries.getByRole('button',{name:/^Fax intern(?! nach)/}).click();
 const sound=prep.getByRole('combobox',{name:'Geräusch beim Eintreffen'});await sound.waitFor();
 assert.equal(await sound.inputValue(),'builtin');assert.equal(await sound.locator('option').first().textContent(),'Typisches Faxgeräusch (eingebaut)');
 await prep.getByRole('button',{name:'Anhören'}).click();await ed.waitForTimeout(400);
 assert.equal(await prep.getByRole('region',{name:'Bilder aus der Galerie Botschaften'}).count(),1);ok('the fax offers its built-in sound, a listen button and its own gallery "Botschaften"');
 await ed.close();

 const gm=await gmc.newPage();gm.on('pageerror',e=>errors.push('GM: '+e.message));
 await gm.goto(base+'/sl/regie?sessionId='+encodeURIComponent(sessionId));
 const desk=gm.getByRole('region',{name:'Visionen und persönliche Botschaften'});await desk.waitFor({timeout:30000});
 const item=title=>desk.getByRole('group',{name:'Vorbereitet in dieser Szene'}).locator('article').filter({has:gm.getByRole('heading',{name:title,exact:true})});
 const looseItem=title=>desk.getByRole('group',{name:'Spontan ausgespielt'}).locator('article').filter({has:gm.getByRole('heading',{name:title,exact:true})});
 // rows are folded to one line; details open on demand
 const expand=async title=>{const t=item(title).getByRole('button',{name:'Aufklappen: '+title});if(await t.count())await t.click();return item(title);};
 const folded=async title=>(await item(title).getByRole('button',{name:'Aufklappen: '+title}).count())===1;
 const table=async(c,name)=>{const p=await c.newPage();p.on('pageerror',e=>errors.push(name+': '+e.message));await p.goto(base+'/spielbereich?bereich=sitzung');await p.locator('[data-layer="stage_objects"]').waitFor({timeout:30000});return p;};
 const a=await table(ac,'A'),b=await table(bc,'B');
 const visionOn=p=>p.getByRole('dialog',{name:'Eine Vision'});
 const finish=async p=>{await p.getByRole('button',{name:'Text vollständig anzeigen'}).click();await p.getByRole('button',{name:'Ich habe alles gesehen'}).click();await visionOn(p).waitFor({state:'detached',timeout:8000});};

 step='GM preview never delivers';
 assert.ok(await folded('Klassisch')&&await folded('Fax intern'),'entries start folded');ok('entries start folded to one line');
 await (await expand('Klassisch')).getByRole('button',{name:'Vorschau'}).click();
 const preview=gm.getByRole('dialog',{name:'Vorschau einer Vision'});await preview.waitFor();await gm.getByText('Vorschau · nichts wird zugestellt').waitFor();
 await gm.waitForTimeout(3600);await gm.screenshot({path:out+'/preset-classic.png'});
 await gm.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gm.getByRole('button',{name:'Ich habe alles gesehen'}).click();await preview.waitFor({state:'detached',timeout:8000});
 assert.equal(await runsCount(),before,'preview created no delivery');assert.equal(await visionOn(a).count(),0);ok('GM preview runs locally and delivers nothing');

 step='single player vision';
 await (await expand('Dunkel')).getByRole('button',{name:'Vision auslösen'}).click();
 await visionOn(a).waitFor({timeout:12000});assert.equal(await visionOn(a).getAttribute('data-preset'),'dark');
 const weiter=a.getByRole('button',{name:'Weiter ›'});await weiter.waitFor({timeout:8000});assert.equal(await weiter.getAttribute('data-hint'),'true');ok('"Weiter" glows on the first text so fast readers know they may skip ahead');
 await b.waitForTimeout(2500);assert.equal(await visionOn(b).count(),0,'B stays on the normal table');ok('only player A is pulled into the dark vision; B keeps playing');
 await a.waitForTimeout(4200);await a.screenshot({path:out+'/preset-dark-player.png'});
 assert.equal(await a.locator('[data-layer="stage_objects"]').evaluate(el=>!!el.closest('[inert]')),true,'table is inert during the vision');ok('the table below is inert while the vision runs');
 await item('Dunkel').getByText(/sieht es gerade/).waitFor({timeout:12000});assert.ok(await folded('Dunkel'),'folds after triggering');ok('the row folds after triggering and still shows "sieht es gerade"');
 assert.equal(await a.getByRole('button',{name:'Ich habe alles gesehen'}).count(),0,'no confirmation before the content was shown');
 for(let i=0;i<4&&!(await a.getByRole('button',{name:'Ich habe alles gesehen'}).count());i++){await a.waitForTimeout(1400);if(await a.getByRole('button',{name:'Weiter'}).count())await a.getByRole('button',{name:'Weiter'}).click();}
 await a.getByRole('button',{name:'Ich habe alles gesehen'}).waitFor({timeout:20000});await a.getByRole('button',{name:'Ich habe alles gesehen'}).click();
 await visionOn(a).waitFor({state:'detached',timeout:8000});await a.locator('[data-layer="stage_objects"]').waitFor();
 assert.equal(await a.locator('[data-layer="stage_objects"]').evaluate(el=>!el.closest('[inert]')),true,'table is usable again');ok('the vision ends only after "Ich habe alles gesehen"; the table returns');
 await item('Dunkel').getByText(/bestätigt/).waitFor({timeout:12000});ok('GM sees "bestätigt"');

 step='whole group, reload during the vision';
 const threat=await expand('Bedrohung');await threat.getByRole('radio',{name:/Ganze Gruppe/}).check();await threat.getByRole('button',{name:'Vision auslösen'}).click();
 await visionOn(a).waitFor({timeout:12000});await visionOn(b).waitFor({timeout:12000});ok('the whole group receives the threatening vision');
 await a.waitForTimeout(5200);await a.screenshot({path:out+'/preset-threat-player.png'});await b.screenshot({path:out+'/preset-threat-mobile.png'});
 assert.ok(await a.locator('svg path').count()>=5,'shadow tentacles are drawn');
 await a.getByRole('button',{name:'Effekte ruhiger'}).click();assert.equal(await visionOn(a).getAttribute('data-reduced'),'true');ok('reduced effects switch on during the vision');
 await a.getByRole('button',{name:'Effekte wieder voll'}).click();
 await b.reload();await visionOn(b).waitFor({timeout:15000});ok('after a reload the unconfirmed vision starts again');
 await finish(a);assert.equal(await visionOn(b).count(),1,'B still sees it');await finish(b);ok('group members confirm independently');

 step='two players, two different deliveries';
 await (await expand('Traum')).getByRole('button',{name:'Vision auslösen'}).click();await (await expand('Fax intern')).getByRole('button',{name:'Botschaft zustellen'}).click();
 await visionOn(a).waitFor({timeout:12000});assert.equal(await visionOn(a).getAttribute('data-preset'),'dream');
 const faxView=b.getByRole('dialog',{name:'Persönliche Botschaft'});await faxView.waitFor({timeout:12000});await b.getByText('Kanzlei Vogt').waitFor();await b.getByText(/Treffen um Mitternacht/).waitFor();
 assert.equal(await faxView.getAttribute('data-sound'),'fax');await b.waitForFunction(()=>['played','blocked'].includes(document.querySelector('[data-sound]')?.getAttribute('data-sound-state')),null,{timeout:5000});ok('the fax arrives with its fax sound ('+await faxView.getAttribute('data-sound-state')+')');
 assert.equal(await visionOn(b).count(),0);ok('A gets the dream vision while B gets the fax');
 await a.waitForTimeout(4200);await a.screenshot({path:out+'/preset-dream-player.png'});await b.waitForTimeout(3600);await b.screenshot({path:out+'/fax-mobile.png'});
 await b.getByRole('button',{name:'Gelesen · ablegen'}).click();await faxView.waitFor({state:'detached',timeout:6000});ok('the fax slides away after "Gelesen"');
 await finish(a);

 step='remaining looks in the GM preview';
 for(const [title,file] of [['Offenbarung','preset-drama.png'],['Echo','preset-echo.png']]){
  await (await expand(title)).getByRole('button',{name:'Vorschau'}).click();const p=gm.getByRole('dialog',{name:'Vorschau einer Vision'});await p.waitFor();await gm.waitForTimeout(3600);await gm.screenshot({path:out+'/'+file});
  await gm.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gm.getByRole('button',{name:'Ich habe alles gesehen'}).click();await p.waitFor({state:'detached',timeout:8000});
 }
 ok('six vision looks captured for comparison');

 step='folded rows open again with their receipts';
 const dark=await expand('Dunkel');await dark.getByText(/: bestätigt/).first().waitFor();await dark.getByRole('button',{name:'Bearbeiten'}).waitFor();
 await dark.getByRole('button',{name:'Einklappen: Dunkel'}).click();assert.ok(await folded('Dunkel'));ok('a delivered row opens again with receipts, resend and edit, and folds back');

 step='spontaneous fax to one player';
 let count=await runsCount();
 await desk.getByRole('button',{name:'Neue Botschaft'}).click();
 const composer=desk.getByRole('region',{name:'Neue Botschaft'});await composer.waitFor();
 await composer.getByLabel('Titel (nur für dich)').fill('Hafen-Fax');await composer.getByLabel('Absender').fill('Hafenmeister');
 await composer.getByLabel('Text der Botschaft').fill('SPONTAN: Das Schiff legt um drei Uhr ab.');
 await composer.getByRole('radio',{name:'Auswahl'}).check();await composer.getByRole('checkbox',{name:/B$/}).check();
 await gm.screenshot({path:out+'/regie-spontan.png'});
 await composer.getByRole('button',{name:'Jetzt zustellen'}).dblclick();
 const spontanFax=b.getByRole('dialog',{name:'Persönliche Botschaft'});await spontanFax.waitFor({timeout:12000});await b.getByText('SPONTAN: Das Schiff legt um drei Uhr ab.').waitFor();await b.getByText('Hafenmeister').waitFor();
 await a.waitForTimeout(2500);assert.equal(await a.getByText(/Das Schiff legt/).count(),0,'A gets nothing');
 assert.equal(await runsCount(),count+1,'one delivery despite the double click');
 await looseItem('Hafen-Fax').getByText(/nicht gespeichert/).waitFor();
 await b.getByRole('button',{name:'Gelesen · ablegen'}).click();await spontanFax.waitFor({state:'detached',timeout:6000});
 ok('a spontaneous fax from the Regie reaches only player B, once, and is listed as not saved');

 step='spontaneous vision for the whole group, kept in the scene';
 count=await runsCount();
 await desk.getByRole('button',{name:'Neue Vision'}).click();
 const visionComposer=desk.getByRole('region',{name:'Neue Vision'});await visionComposer.waitFor();
 await visionComposer.getByLabel('Titel (nur für dich)').fill('Spontaner Schatten');await visionComposer.getByLabel('Visionstyp').selectOption('threat');
 await visionComposer.getByLabel('Text der Vision').fill('Ein Schatten löst sich von der Wand.\n\nEr kommt näher.');
 await visionComposer.getByRole('checkbox',{name:/In dieser Szene speichern/}).check();
 await visionComposer.getByRole('button',{name:'Jetzt ausspielen'}).click();
 await visionOn(a).waitFor({timeout:12000});await visionOn(b).waitFor({timeout:12000});assert.equal(await visionOn(a).getAttribute('data-preset'),'threat');
 await finish(a);await finish(b);
 assert.equal(await runsCount(),count+1);await item('Spontaner Schatten').waitFor();assert.ok(await folded('Spontaner Schatten'));
 ok('a spontaneous vision reaches the whole group and stays in the scene as a folded entry');

 step='preview on the GM table';
 count=await runsCount();
 const gmTable=await table(gmc,'GM-Tisch');
 await (await expand('Echo')).getByRole('button',{name:'Vorschau'}).click();
 const tablePreview=gmTable.getByRole('dialog',{name:'Vorschau einer Vision'});await tablePreview.waitFor({timeout:8000});
 assert.equal(await gm.getByRole('dialog',{name:'Vorschau einer Vision'}).count(),0,'not in the Regie');await gm.getByText(/Vorschau läuft auf deinem Spieltisch/).waitFor();
 await gmTable.waitForTimeout(3600);await gmTable.screenshot({path:out+'/preview-on-gm-table.png'});
 assert.equal(await visionOn(a).count()+await visionOn(b).count(),0,'players see nothing');
 await gmTable.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gmTable.getByRole('button',{name:'Ich habe alles gesehen'}).click();await tablePreview.waitFor({state:'detached',timeout:8000});
 await item('Echo').getByRole('button',{name:'Vorschau'}).click();await tablePreview.waitFor({timeout:8000});await gmTable.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gmTable.getByRole('button',{name:'Ich habe alles gesehen'}).click();await tablePreview.waitFor({state:'detached',timeout:8000});
 await desk.getByRole('button',{name:'Neue Botschaft'}).click();const draft=desk.getByRole('region',{name:'Neue Botschaft'});await draft.getByLabel('Text der Botschaft').fill('Nur zur Probe');
 await draft.getByRole('button',{name:'Vorschau auf meinem Tisch'}).click();
 const tableFax=gmTable.getByRole('dialog',{name:'Vorschau einer persönlichen Botschaft'});await tableFax.waitFor({timeout:8000});await gmTable.getByText('Nur zur Probe').waitFor();
 await b.waitForTimeout(1500);assert.equal(await b.getByText('Nur zur Probe').count(),0,'B sees nothing of the preview');
 await tableFax.getByRole('button',{name:/^Gelesen/}).click();await tableFax.waitFor({state:'detached',timeout:6000});await draft.getByRole('button',{name:'Abbrechen'}).click();
 assert.equal(await runsCount(),count,'previews create no delivery and no receipt');
 ok('previews from the Regie play on the GM table only, can be repeated and deliver nothing');
 assert.deepEqual(errors,[],'no page errors');ok('no page errors in GM, GM table, A or B');
 console.log('PASS live deliveries browser');
}catch(error){console.error('FAIL at '+step,error);process.exitCode=1;}finally{await browser.close();}
