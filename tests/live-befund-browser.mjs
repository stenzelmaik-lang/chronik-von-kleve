import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Fixes from the live check of 31.10.2026 in a real browser against scripts/start-material-3.ps1:
// 1 a new display asset survives choosing its image (nested dialogs) and can be saved and selected,
// 2 lists use small previews that the browser stores once,
// 3 "An mich testen" shows the real player pager with tone to the GM alone, the mirror has its own tone switch,
// 4 the Regie offers only the scene image as stage background.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8893','8894'].includes(new URL(base).port),'Use the isolated synthetic material fixture only');
const output='.local-work/ux-check/live-befund';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];
const pass=label=>console.log('PASS '+label);
try{
 const gm=await browser.newContext({viewport:{width:1440,height:900}});
 assert.equal((await gm.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();assert.ok(active.room?.started,'Start the synthetic evening first');
 const catalog=await (await gm.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(active.room.sessionId)+'&catalog=1')).json();
 const kaserne=catalog.scenes.find(s=>s.title.includes('Kaserne')).id;

 // 1+2. New display asset through the image choice; previews instead of originals.
 const prep=await gm.newPage();prep.setDefaultTimeout(15000);prep.on('pageerror',e=>errors.push('prep: '+e.message));
 const thumbs=[];prep.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/files'&&u.searchParams.get('id'))thumbs.push(u.searchParams.get('size')||'original:'+u.searchParams.get('id'));});
 await prep.goto(base+'/sl/command-center?bereich=vorbereitung&material=szenen&szene='+encodeURIComponent(kaserne));
 await prep.getByRole('heading',{name:'Interaktionen & Spielmaterial'}).waitFor();
 await prep.locator('[data-material-card]',{hasText:'Verschollener Umschlag'}).first().getByRole('button',{name:'Bearbeiten',exact:true}).click();
 await prep.getByRole('button',{name:'Gestaltung'}).click();
 await prep.getByRole('button',{name:/Darstellung (wählen|ändern)/}).first().click();
 const gallery=prep.getByRole('dialog',{name:'Darstellungs-Assets'});await gallery.waitFor();
 const box=await gallery.boundingBox();assert.ok(box.y>20,'asset window is centred, not glued to the top ('+box.y+')');
 await gallery.getByRole('button',{name:'Neue Darstellung'}).click();
 await gallery.getByLabel('Name').fill('Testumschlag Live-Befund');
 await gallery.getByRole('button',{name:'Bild wählen'}).first().click();
 const picker=prep.getByRole('dialog',{name:/Bild für/});await picker.waitFor();
 await picker.getByRole('button',{name:'Diese Szene'}).waitFor();
 assert.match(await picker.getByRole('button',{name:'Diese Szene'}).innerText(),/[1-9]/,'scene files are offered in the asset editor');
 await picker.locator('ul button[aria-pressed]').first().click();
 await picker.getByRole('button',{name:'Übernehmen'}).click();
 await picker.waitFor({state:'detached'});
 assert.ok(await gallery.isVisible(),'the asset window stays open after choosing the image');
 await gallery.getByRole('region',{name:'Neue Darstellung'}).waitFor();
 assert.equal(await gallery.getByLabel('Name').inputValue(),'Testumschlag Live-Befund','the draft is kept');
 await gallery.getByRole('button',{name:'Darstellung speichern'}).click();
 await gallery.getByText('Testumschlag Live-Befund').first().waitFor();
 pass('a new display asset survives the image choice and is saved');
 assert.ok(thumbs.includes('thumb')&&!thumbs.some(x=>x.startsWith('original')),'pickers and cards request previews only ('+[...new Set(thumbs)].join(',')+')');
 await prep.screenshot({path:output+'/asset-saved.png'});
 pass('lists request previews, not originals');

 // 3+4. Regie: self test of the pager and stage image from the scene only.
 const regie=await gm.newPage();regie.setDefaultTimeout(15000);regie.on('pageerror',e=>errors.push('regie: '+e.message));
 await regie.addInitScript(()=>{const W=window;W.__rings=0;const C=W.AudioContext||W.webkitAudioContext;if(C){const start=C.prototype.createBufferSource;C.prototype.createBufferSource=function(){const s=start.call(this);const go=s.start.bind(s);s.start=(...x)=>{W.__rings++;return go(...x);};return s;};}});
 await regie.goto(base+'/sl/regie');
 await regie.getByRole('button',{name:'Pager',exact:true}).click();
 const spontaneous=regie.locator('#regie-bereich-pager');await spontaneous.waitFor();
 assert.ok(await regie.evaluate(()=>{const r=document.getElementById('regie-bereich-pager').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}),'the Pager area button jumps to the pager');
 await regie.getByLabel('Pager-Nachricht').fill('TEST FÜR DIE SL');
 await regie.mouse.click(5,5);
 await regie.getByRole('button',{name:'An mich testen'}).last().click();
 const test=regie.locator('[data-pager-selftest]');await test.waitFor();
 await test.getByRole('region',{name:'Pager'}).waitFor();
 await test.getByText('TEST FÜR DIE SL').or(test.getByText('EINGANG (1)')).first().waitFor();
 await regie.waitForFunction(()=>window.__rings>0,null,{timeout:5000,polling:200}).catch(()=>{});
 const rings=await regie.evaluate(()=>window.__rings);
 assert.ok(rings>0,'the self test plays the pager tone ('+rings+')');
 await regie.waitForTimeout(1500);// let the float-in animation finish
 assert.equal(await test.locator('[aria-roledescription="Pager"]').evaluate(el=>{let o=1;for(let n=el;n;n=n.parentElement)o*=Number(getComputedStyle(n).opacity);return o;}),1,'the self-test pager is fully opaque');
 await regie.screenshot({path:output+'/pager-selftest.png'});
 await test.getByRole('button',{name:'Test beenden'}).click();await test.waitFor({state:'detached'});
 const before=await (await gm.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(active.room.sessionId))).json();
 assert.equal((before.pagers||[]).some(p=>p.text==='TEST FÜR DIE SL'),false,'the self test sends nothing');
 pass('An mich testen: real pager with tone, nothing sent');
 assert.equal(await regie.getByText(/Anderes Bild wählen/).count(),0,'no free gallery choice for the stage image');
 pass('stage image only from the scene');
}finally{await browser.close();}
assert.deepEqual(errors,[],'no page errors');
console.log('Live-Befund browser: all checks passed. Screenshots in '+output);
