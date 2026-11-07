import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {emptyScene} from '../domain/story-scene.ts';
import {KLEVE_CAMPAIGN_ID} from '../domain/types.ts';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8901';assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):8901$/,'Synthetic local fixture only');
const output='.local-work/regie-material-access';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined}),checks=[],errors=[];let page,phase='setup';
const pass=label=>{checks.push(label);console.log('PASS '+label);};
async function request(ctx,path,data,status=200){const r=await ctx.request.fetch(base+path,{method:data?'POST':'GET',headers:{Origin:base},...(data?{data}:{})});const body=await r.json();assert.equal(r.status(),status,path+' '+JSON.stringify(body).slice(0,180));return body;}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});await request(ctx,'/api/auth/login',{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'});
 const active=await request(ctx,'/api/live-table?view=active');assert.ok(active.room?.title.startsWith('SYNTHETISCH'));const q='/api/live-stage?sessionId='+active.room.sessionId;
 const snapshot=await request(ctx,q+'&catalog=1'),stamp=randomUUID().slice(0,8),sceneMaterial='SYNTHETISCH Szenenmaterial '+stamp,spontaneous='SYNTHETISCH Spontanmaterial '+stamp;
 const document=emptyScene();document.title='SYNTHETISCH Materialzugang '+stamp;document.elements=[{id:randomUUID(),kind:'handout',title:sceneMaterial,text:'SYNTHETIC_SCENE_SECRET',referenceId:'',fileId:'',material:{type:'letter',files:[],assetId:'',display:'single',note:'',effect:{open:'fade',close:'fade',speed:'normal',soundFileId:'',afterClose:'closed'}}}];
 const scene=(await request(ctx,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document},201)).scene;
 const empty=(await request(ctx,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document:{...emptyScene(),title:'SYNTHETISCH Ohne Material '+stamp}},201)).scene;
 await request(ctx,'/api/table-materials',{material:{title:spontaneous,kind:'document',text:'SYNTHETIC_LIBRARY_SECRET',fileId:'',pages:[]}});
 const layoutKey='chroniplay:regie-layout:'+KLEVE_CAMPAIGN_ID+':'+snapshot.principal.id;
 await ctx.addInitScript(({layoutKey,sceneId})=>{if(sessionStorage.getItem('material-access-seeded'))return;sessionStorage.setItem('material-access-seeded','1');localStorage.setItem(layoutKey,JSON.stringify({order:['Szenenmaterial','material','narration'],hidden:['Szenenmaterial','material'],wide:['Szenenmaterial']}));localStorage.setItem('chroniplay:regie-bereich:command-gm','narration');localStorage.setItem('chroniplay:regie:'+sceneId.run,JSON.stringify({sceneId:sceneId.id}));},{layoutKey,sceneId:{run:active.room.runId,id:scene.id}});
 page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));let writes=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/live-stage')writes++;});await page.goto(base+'/sl/regie');await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(scene.id);
 const nav=page.getByRole('navigation',{name:'Bereiche der Szene'}),sceneButton=nav.getByRole('button',{name:'Szenenmaterialien',exact:true}),spontaneousButton=nav.getByRole('button',{name:'Spontanmaterialien',exact:true});
 const sceneTile=page.locator('[data-area="Szenenmaterial"]'),spontaneousTile=page.locator('[data-area="material"]');
 await sceneTile.waitFor({state:'attached'});assert.equal(await sceneTile.isVisible(),false);assert.equal(await spontaneousTile.isVisible(),false);
 assert.equal(await sceneButton.locator('svg').count(),1);assert.equal(await spontaneousButton.locator('svg').count(),1);
 phase='restore hidden';await sceneButton.click();await sceneTile.waitFor({state:'visible'});await sceneTile.getByText(sceneMaterial,{exact:true}).waitFor();assert.equal(await sceneTile.getAttribute('data-wide'),'true','Existing wide preference retained');assert.equal(await spontaneousTile.isVisible(),false,'Reopening scene material does not reopen spontaneous material');
 assert.equal(await sceneTile.getByText(spontaneous,{exact:true}).count(),0);await spontaneousButton.click();await spontaneousTile.waitFor({state:'visible'});await spontaneousTile.getByRole('heading',{name:spontaneous,exact:true}).waitFor();assert.equal(await spontaneousTile.getByText(sceneMaterial,{exact:true}).count(),0);
 pass('Zwei eigene Icons öffnen getrennte Inhalte; alte ausgeblendete Kacheln und Größenpräferenzen bleiben kompatibel');
 phase='hide and reload';await nav.getByRole('button',{name:'Erzählung',exact:true}).click();await sceneTile.getByRole('button',{name:'Szenenmaterialien ausblenden',exact:true}).click();await spontaneousTile.getByRole('button',{name:'Spontanmaterialien ausblenden',exact:true}).click();await page.reload();await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(scene.id);await sceneTile.waitFor({state:'attached'});assert.equal(await sceneTile.isVisible(),false);assert.equal(await spontaneousTile.isVisible(),false);
 await sceneButton.click();await sceneTile.getByText(sceneMaterial,{exact:true}).waitFor();await spontaneousButton.click();await spontaneousTile.getByRole('heading',{name:spontaneous,exact:true}).waitFor();
 pass('Beide Bereiche lassen sich nach Schließen und Neuladen direkt über ihren Button wieder öffnen');
 phase='empty scene';await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(empty.id);await sceneButton.click();await sceneTile.getByText('Für diese Szene ist noch kein Szenenmaterial vorbereitet.',{exact:true}).waitFor();await sceneTile.getByRole('button',{name:'Szenenmaterialien ausblenden',exact:true}).click();await sceneButton.click();await sceneTile.waitFor({state:'visible'});assert.equal(await spontaneousTile.getByRole('heading',{name:spontaneous,exact:true}).count(),1);
 pass('Szenen ohne Material bleiben mit verständlichem Leerzustand aufrufbar; spontane Vorlagen bleiben szenenunabhängig');
 phase='responsive';await page.getByLabel('Szene in der Regie',{exact:true}).selectOption(scene.id);await sceneButton.click();await sceneTile.getByText(sceneMaterial,{exact:true}).waitFor();await page.screenshot({path:output+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await sceneButton.click();await sceneTile.getByText(sceneMaterial,{exact:true}).waitFor();await spontaneousButton.click();await spontaneousTile.getByRole('heading',{name:spontaneous,exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:output+'/mobile-390.png',fullPage:true});
 assert.equal(writes,0,'Opening, closing and switching material areas never publishes anything');assert.deepEqual(errors,[]);
 pass('Desktop und 390 px ohne Seitenüberlauf; Öffnen und Schließen veröffentlicht keine Materialien');writeFileSync(output+'/result.json',JSON.stringify({checks,errors,stageWrites:writes},null,2));console.log('ALL PASS: '+checks.length+' material access workflows');
}catch(e){console.error('FAILED PHASE '+phase);if(page)await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
