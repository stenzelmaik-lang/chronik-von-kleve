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

 const gm=await gmc.newPage();gm.on('pageerror',e=>errors.push('GM: '+e.message));
 await gm.goto(base+'/sl/regie?sessionId='+encodeURIComponent(sessionId));
 const desk=gm.getByRole('region',{name:'Visionen und persönliche Botschaften'});await desk.waitFor({timeout:30000});
 const item=title=>desk.locator('article').filter({has:gm.getByRole('heading',{name:title,exact:true})});
 const table=async(c,name)=>{const p=await c.newPage();p.on('pageerror',e=>errors.push(name+': '+e.message));await p.goto(base+'/spielbereich?bereich=sitzung');await p.locator('[data-layer="stage_objects"]').waitFor({timeout:30000});return p;};
 const a=await table(ac,'A'),b=await table(bc,'B');
 const visionOn=p=>p.getByRole('dialog',{name:'Eine Vision'});
 const finish=async p=>{await p.getByRole('button',{name:'Text vollständig anzeigen'}).click();await p.getByRole('button',{name:'Ich habe alles gesehen'}).click();await visionOn(p).waitFor({state:'detached',timeout:8000});};

 step='GM preview never delivers';
 await item('Klassisch').getByRole('button',{name:'Vorschau'}).click();
 const preview=gm.getByRole('dialog',{name:'Vorschau einer Vision'});await preview.waitFor();await gm.getByText('Vorschau · nichts wird zugestellt').waitFor();
 await gm.waitForTimeout(3600);await gm.screenshot({path:out+'/preset-classic.png'});
 await gm.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gm.getByRole('button',{name:'Ich habe alles gesehen'}).click();await preview.waitFor({state:'detached',timeout:8000});
 assert.equal(await runsCount(),before,'preview created no delivery');assert.equal(await visionOn(a).count(),0);ok('GM preview runs locally and delivers nothing');

 step='single player vision';
 await item('Dunkel').getByRole('button',{name:'Vision auslösen'}).click();
 await visionOn(a).waitFor({timeout:12000});assert.equal(await visionOn(a).getAttribute('data-preset'),'dark');
 await b.waitForTimeout(2500);assert.equal(await visionOn(b).count(),0,'B stays on the normal table');ok('only player A is pulled into the dark vision; B keeps playing');
 await a.waitForTimeout(4200);await a.screenshot({path:out+'/preset-dark-player.png'});
 assert.equal(await a.locator('[data-layer="stage_objects"]').evaluate(el=>!!el.closest('[inert]')),true,'table is inert during the vision');ok('the table below is inert while the vision runs');
 await item('Dunkel').getByText(/sieht es gerade/).waitFor({timeout:12000});ok('GM sees "sieht es gerade"');
 assert.equal(await a.getByRole('button',{name:'Ich habe alles gesehen'}).count(),0,'no confirmation before the content was shown');
 for(let i=0;i<4&&!(await a.getByRole('button',{name:'Ich habe alles gesehen'}).count());i++){await a.waitForTimeout(1400);if(await a.getByRole('button',{name:'Weiter'}).count())await a.getByRole('button',{name:'Weiter'}).click();}
 await a.getByRole('button',{name:'Ich habe alles gesehen'}).waitFor({timeout:20000});await a.getByRole('button',{name:'Ich habe alles gesehen'}).click();
 await visionOn(a).waitFor({state:'detached',timeout:8000});await a.locator('[data-layer="stage_objects"]').waitFor();
 assert.equal(await a.locator('[data-layer="stage_objects"]').evaluate(el=>!el.closest('[inert]')),true,'table is usable again');ok('the vision ends only after "Ich habe alles gesehen"; the table returns');
 await item('Dunkel').getByText(/bestätigt/).waitFor({timeout:12000});ok('GM sees "bestätigt"');

 step='whole group, reload during the vision';
 const threat=item('Bedrohung');await threat.getByRole('radio',{name:/Ganze Gruppe/}).check();await threat.getByRole('button',{name:'Vision auslösen'}).click();
 await visionOn(a).waitFor({timeout:12000});await visionOn(b).waitFor({timeout:12000});ok('the whole group receives the threatening vision');
 await a.waitForTimeout(5200);await a.screenshot({path:out+'/preset-threat-player.png'});await b.screenshot({path:out+'/preset-threat-mobile.png'});
 assert.ok(await a.locator('svg path').count()>=5,'shadow tentacles are drawn');
 await a.getByRole('button',{name:'Effekte ruhiger'}).click();assert.equal(await visionOn(a).getAttribute('data-reduced'),'true');ok('reduced effects switch on during the vision');
 await a.getByRole('button',{name:'Effekte wieder voll'}).click();
 await b.reload();await visionOn(b).waitFor({timeout:15000});ok('after a reload the unconfirmed vision starts again');
 await finish(a);assert.equal(await visionOn(b).count(),1,'B still sees it');await finish(b);ok('group members confirm independently');

 step='two players, two different deliveries';
 await item('Traum').getByRole('button',{name:'Vision auslösen'}).click();await item('Fax intern').getByRole('button',{name:'Botschaft zustellen'}).click();
 await visionOn(a).waitFor({timeout:12000});assert.equal(await visionOn(a).getAttribute('data-preset'),'dream');
 const faxView=b.getByRole('dialog',{name:'Persönliche Botschaft'});await faxView.waitFor({timeout:12000});await b.getByText('Kanzlei Vogt').waitFor();await b.getByText(/Treffen um Mitternacht/).waitFor();
 assert.equal(await visionOn(b).count(),0);ok('A gets the dream vision while B gets the fax');
 await a.waitForTimeout(4200);await a.screenshot({path:out+'/preset-dream-player.png'});await b.waitForTimeout(3600);await b.screenshot({path:out+'/fax-mobile.png'});
 await b.getByRole('button',{name:'Gelesen · ablegen'}).click();await faxView.waitFor({state:'detached',timeout:6000});ok('the fax slides away after "Gelesen"');
 await finish(a);

 step='remaining looks in the GM preview';
 for(const [title,file] of [['Offenbarung','preset-drama.png'],['Echo','preset-echo.png']]){
  await item(title).getByRole('button',{name:'Vorschau'}).click();const p=gm.getByRole('dialog',{name:'Vorschau einer Vision'});await p.waitFor();await gm.waitForTimeout(3600);await gm.screenshot({path:out+'/'+file});
  await gm.getByRole('button',{name:'Text vollständig anzeigen'}).click();await gm.getByRole('button',{name:'Ich habe alles gesehen'}).click();await p.waitFor({state:'detached',timeout:8000});
 }
 ok('six vision looks captured for comparison');
 assert.deepEqual(errors,[],'no page errors');ok('no page errors in GM, A or B');
 console.log('PASS live deliveries browser');
}catch(error){console.error('FAIL at '+step,error);process.exitCode=1;}finally{await browser.close();}
