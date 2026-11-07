import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Zustandswerte der Runde in real browsers: live overview bottom left for everyone, the player's own dropdown in the
// header menu, damage flash for all and the condition block in the Regie window. 1920, 1440, 125 %; player at 375 px.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8874','8875','8881'].includes(new URL(base).port),'Use the isolated synthetic fixture only');
const output='.local-work/ux-check/zustandswerte-runde';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25}];
const mobile={viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='setup';
const pass=label=>console.log('PASS '+label);
async function account(id,options){const context=await browser.newContext(options);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;}
const watch=(p,label)=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(phase+' '+label+': '+e.message));return p;};
async function table(context,label){const p=watch(await context.newPage(),label);await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}
let setup,room,ca,nameA;
const vitals=async()=>(await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json()).vitals;
async function gmOp(command){const r=await setup.request.post(base+'/api/live-vitals',{headers:{Origin:base},data:{...room,characterId:ca.id,command}});assert.equal(r.status(),200,JSON.stringify(command));}
async function restore(){const v=(await vitals()).characters.find(c=>c.id===ca.id).vitals;if(v.health.track.length)await gmOp({op:'reset',target:'health'});if(v.blood.current!==v.blood.max)await gmOp({op:'reset',target:'blood'});if(v.willpower.temporary!==v.willpower.permanent)await gmOp({op:'reset',target:'willpower'});}
const row=(p,id)=>p.locator('[data-round-character="'+id+'"]');
const bloodOf=async(p,id)=>(await row(p,id).locator('small').first().getAttribute('aria-label'));
try{
 setup=await browser.newContext();
 assert.equal((await setup.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await setup.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 room={sessionId:active.room.sessionId,runId:active.room.runId};
 const v0=await vitals();ca=v0.characters.find(c=>c.ownerId==='command-a');assert.ok(ca,'A has a character');
 const s0=await (await setup.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).json();nameA=s0.crew.find(m=>m.id==='command-a').name;
 const tv=await vitals();await setup.request.post(base+'/api/live-vitals',{headers:{Origin:base},data:{...room,expectedVersion:tv.version,table:{op:'settings',roundView:'all',damageBy:'player',profile:'empfohlen'}}});
 await restore();
 for(const config of viewports){
  const {name,...options}=config;phase=name;
  const [gm,a,b]=await Promise.all([account('command-gm',options),account('command-a',options),account('command-b',{...options,reducedMotion:'reduce'})]);
  const [sl,pa,pb]=await Promise.all([table(gm,'SL'),table(a,'A'),table(b,'B')]);
  const playerA=pb.getByRole('navigation',{name:'Spielerleiste'}).getByRole('button',{name:nameA+' \u00b7 Am Tisch',exact:true});
  await playerA.click();
  await pb.locator('[data-participant-menu]').waitFor();
  await playerA.click();
  await pb.locator('[data-participant-menu]').waitFor({state:'hidden'});
  assert.equal(await playerA.getAttribute('aria-expanded'),'false');
  // 3. Live overview bottom left: B sees A with blood and willpower.
  await row(pb,ca.id).waitFor();const before=await bloodOf(pb,ca.id);
  const box=await row(pb,ca.id).boundingBox(),vp=pb.viewportSize();assert.ok(box.x<vp.width/2&&box.y>vp.height/2,name+': overview sits bottom left');
  // 2. A's own dropdown in the header menu.
  await pa.getByRole('button',{name:new RegExp('^'+nameA+' · ')}).click();
  await pa.getByLabel('Eigene Werte steuern').selectOption({label:'1 Blut ausgeben'});await pa.getByRole('button',{name:'Ausführen'}).click();
  await pa.getByText('1 Blut ausgeben gebucht.').waitFor({state:'attached'});
  await pb.waitForFunction(([id,old])=>document.querySelector('[data-round-character="'+id+'"] small')?.getAttribute('aria-label')!==old,[ca.id,before]);
  pass(name+': A books own blood from the header menu, B sees it live in the overview');
  // 4. Damage by the player: everyone sees the flash and the level.
  await pa.getByLabel('Eigene Werte steuern').selectOption({label:'Schaden: 1 Tödlich'});await pa.getByRole('button',{name:'Ausführen'}).click();
  // The flash lasts about two seconds: watch both tables at the same time.
  await Promise.all([pb,sl].map(p=>row(p,ca.id).and(p.locator('[data-hit]')).waitFor()));
  assert.notEqual(await row(pb,ca.id).locator('[class*=roundLevel]').textContent(),'Unverletzt');
  await sl.screenshot({path:output+'/'+name+'-sl.png'});await pb.screenshot({path:output+'/'+name+'-spieler-b.png'});
  pass(name+': player damage flashes at the entry for SL and B, damage level shown');
  // 1. Regie window: the SL corrects with quick actions.
  const regie=watch(await gm.newPage(),'Regie');await regie.goto(base+'/sl/regie');await regie.getByRole('heading',{name:/Texte zum Vorlesen/}).waitFor();
  await regie.getByRole('navigation',{name:'Bereiche der Szene'}).getByRole('button',{name:'Zustände',exact:true}).click();
  const entry=regie.locator('[data-vitals-character="'+ca.id+'"]');await entry.waitFor();
  await entry.getByRole('button',{name:ca.title+': 1 Stufe heilen'}).click();
  // Healed: the damage level line disappears again (it is only shown while hurt).
  await pb.waitForFunction(id=>{const r=document.querySelector('[data-round-character="'+id+'"]');return !!r&&!r.querySelector('[class*=roundLevel]');},ca.id);
  await entry.getByRole('button',{name:ca.title+': 1 Blut dazu'}).click();
  await regie.screenshot({path:output+'/'+name+'-regie.png'});
  pass(name+': Regie window shows the round and corrects damage and blood for everyone');
  await Promise.all([gm.close(),a.close(),b.close()]);await restore();
 }
 phase='375';
 const a=await account('command-a',mobile),pa=await table(a,'A375');
 await row(pa,v0.characters.find(c=>c.ownerId==='command-b').id).waitFor();
 for(const r of await pa.locator('[data-round-character]').all()){const box=await r.boundingBox();if(box)assert.ok(box.x>=0&&box.x+box.width<=375+1,'Overview row fits 375 px');}
 const [w,inner]=await pa.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(w<=inner+1,'No horizontal scroll');
 await pa.getByRole('button',{name:new RegExp('^'+nameA+' · ')}).click();const select=await pa.getByLabel('Eigene Werte steuern').boundingBox();assert.ok(select&&select.x>=0&&select.x+select.width<=376,'Dropdown fits');
 await pa.screenshot({path:output+'/375-spieler-a.png'});
 pass('375: overview and own dropdown fit a phone');
 assert.deepEqual(errors,[],'No page errors');
 console.log('ALL PASS: Zustandswerte der Runde im Browser');
}catch(e){console.error('FAIL in phase '+phase);throw e;}
finally{await browser.close();}
