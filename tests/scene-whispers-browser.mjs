import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const f=JSON.parse(readFileSync('.local-work/whispers/fixture.json','utf8')),base=f.base;
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out='.local-work/whispers/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
async function account(id){const c=await browser.newContext({viewport:{width:1440,height:900}});const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(r.status(),200);return c;}
async function settled(p){await p.locator('dialog[open]').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));}
async function table(c){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/spielbereich?bereich=sitzung');
 // The live table continuously polls; readiness is its rendered recipient-specific view, not an idle network.
 await p.getByRole('dialog').waitFor();return p;}
try{
 const ca=await account('command-a'),cb=await account('command-b'),cg=await account('command-gm');
 const a=await table(ca),b=await table(cb);
 await a.getByRole('heading',{name:'Vision nur A',exact:true}).waitFor();await b.getByRole('heading',{name:'Vision nur B',exact:true}).waitFor();
 assert.equal(await a.locator('dialog[open]').getAttribute('aria-modal'),'false');
 assert.equal(await a.locator('dialog[open]').evaluate(el=>el.matches(':modal')),false,'vision must leave the table interactive');
 await settled(a);let visionBounds=await a.locator('dialog[open]').boundingBox();
 assert.ok(visionBounds.x<150&&visionBounds.y<150&&visionBounds.y+visionBounds.height<500,'vision occupies only the upper left area');
 assert.ok((await a.locator('dialog[open]').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('mist-v2.webp'));
 assert.equal(await b.getByText('SECRET_A_VISION',{exact:true}).count(),0);assert.equal(await a.getByText('SECRET_B_VISION',{exact:true}).count(),0);
 await a.locator('dialog[open] img').waitFor();await a.locator('dialog[open] img').evaluate(img=>img.decode());
 await a.getByRole('button',{name:'Nächstes Bild',exact:true}).click();assert.ok((await a.locator('dialog[open] img').getAttribute('src')).endsWith('&page=1'));
 await a.locator('dialog[open] img').evaluate(img=>Promise.all([img.decode(),...img.getAnimations().map(a=>a.finished)]));
 await settled(a);await a.screenshot({path:out+'/vision-desktop.png'});
 await a.getByRole('button',{name:'Kontext öffnen',exact:true}).click();await a.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();
 assert.equal(await a.locator('dialog[open]').count(),1,'other tools remain usable while the vision is open');
 await a.getByRole('button',{name:'Persönliche Ansicht schließen'}).focus();
 await a.keyboard.press('Escape');await a.locator('dialog[open]').waitFor({state:'detached'});
 await b.getByRole('heading',{name:'Vision nur B',exact:true}).waitFor();
 const letter=a.getByRole('button',{name:'Brief öffnen: Brief nur A',exact:true});assert.ok((await letter.locator('img').getAttribute('src')).includes('envelope-v2.webp'));await letter.focus();await a.keyboard.press('Enter');
 await settled(a);const letterBounds=await a.locator('dialog[open]').boundingBox();assert.ok(letterBounds.x>720&&letterBounds.y<150,'opened paper stays on the right');
 assert.ok((await a.locator('dialog[open]').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('paper-v2.webp'));
 await a.getByRole('heading',{name:'Brief nur A',exact:true}).waitFor();await a.getByText('SECRET_A_LETTER',{exact:true}).waitFor();await settled(a);await a.screenshot({path:out+'/letter-desktop.png'});
 for(let i=0;i<3;i++){
  await a.getByRole('button',{name:'Persönliche Ansicht schließen'}).click();await a.getByRole('button',{name:'Vision ansehen: Vision nur A',exact:true}).click();await a.getByRole('heading',{name:'Vision nur A',exact:true}).waitFor();
  await a.getByRole('button',{name:'Persönliche Ansicht schließen'}).click();await a.getByRole('button',{name:'Brief öffnen: Brief nur A',exact:true}).click();await a.getByRole('heading',{name:'Brief nur A',exact:true}).waitFor();
 }
 await a.getByRole('button',{name:'Persönliche Ansicht schließen'}).click();await a.reload();await a.getByRole('button',{name:'Brief öffnen: Brief nur A',exact:true}).waitFor();assert.equal(await a.locator('dialog[open]').count(),0,'reconnect does not replay dismissed visions');
 await a.setViewportSize({width:375,height:812});await a.emulateMedia({reducedMotion:'reduce'});
 await a.getByRole('button',{name:'Brief öffnen: Brief nur A',exact:true}).click();await a.getByRole('heading',{name:'Brief nur A',exact:true}).waitFor();
 let bounds=await a.locator('dialog[open]').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=376);await a.screenshot({path:out+'/letter-mobile.png'});
 await a.keyboard.press('Escape');await a.getByRole('button',{name:'Vision ansehen: Vision nur A',exact:true}).click();await a.getByRole('heading',{name:'Vision nur A',exact:true}).waitFor();
 assert.equal(await a.locator('dialog[open]').evaluate(e=>getComputedStyle(e).animationName),'none');await a.locator('dialog[open] img').evaluate(img=>img.decode());await a.screenshot({path:out+'/vision-mobile.png'});
 visionBounds=await a.locator('dialog[open]').boundingBox();assert.ok(visionBounds.y+visionBounds.height<812*.65,'mobile vision leaves the lower table free');
 const gm=await cg.newPage();gm.on('pageerror',e=>errors.push(e.message));
 await gm.goto(base+'/sl/command-center?bereich=sitzung&scene='+encodeURIComponent(f.sceneId)+'&section=visions');
 const preparation=gm.getByRole('region',{name:'Visionen und persönliche Botschaften vorbereiten'});await preparation.waitFor();

 await preparation.getByRole('button',{name:'Vision vorbereiten',exact:true}).click();
 await preparation.getByLabel('Titel',{exact:true}).fill('Zweite Vision für Spieler B');
 await preparation.locator('[contenteditable=true]').fill('Eine weitere unabhängig vorbereitete Vision.');
 const boxes=preparation.getByRole('checkbox');assert.ok(await boxes.count()>=2);await boxes.nth(1).check();
 await preparation.getByRole('button',{name:'Botschaft vorbereiten',exact:true}).click();
 await preparation.getByLabel('Titel',{exact:true}).fill('Zweiter Brief für Spieler A');await preparation.locator('[contenteditable=true]').fill('Ein zweiter persönlicher Brief.');await preparation.getByRole('checkbox').nth(0).check();
 assert.equal(await preparation.getByRole('list',{name:'Vorbereitete persönliche Inhalte'}).getByRole('listitem').count(),5);
 await Promise.all([gm.waitForResponse(r=>r.url().includes('/api/command-center/scenes')&&r.request().method()==='POST'&&r.status()===200),gm.getByRole('button',{name:'Jetzt speichern',exact:true}).click()]);
 const saved=await cg.request.get(base+'/api/command-center/scenes?id='+f.sceneId);assert.equal((await saved.json()).scene.document.whispers.length,5);
 await gm.reload();await gm.getByRole('region',{name:'Visionen und persönliche Botschaften vorbereiten'}).waitFor();
 assert.equal(await gm.getByRole('list',{name:'Vorbereitete persönliche Inhalte'}).getByRole('listitem').count(),5);
 await gm.screenshot({path:out+'/preparation-desktop.png',fullPage:true});
 await gm.setViewportSize({width:390,height:844});await gm.screenshot({path:out+'/preparation-mobile.png',fullPage:true});
 assert.equal(await gm.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no editor page overflow');
 await gm.setViewportSize({width:1440,height:900});await gm.goto(base+'/sl/regie?sessionId='+f.sessionId);
 await gm.getByRole('button',{name:'Visionen & Briefe',exact:true}).click();
 const releases=gm.getByRole('region',{name:'Vorbereitete Visionen und Botschaften'});await releases.waitFor();
 await b.keyboard.press('Escape');
 const preparedVision=releases.getByRole('article').filter({has:gm.getByRole('heading',{name:'Zweite Vision für Spieler B',exact:true})});
 await preparedVision.getByRole('button',{name:'Vision ausspielen',exact:true}).click();await b.getByRole('heading',{name:'Zweite Vision für Spieler B',exact:true}).waitFor();
 assert.equal(await a.getByText('Eine weitere unabhängig vorbereitete Vision.',{exact:true}).count(),0);
 const preparedLetter=releases.getByRole('article').filter({has:gm.getByRole('heading',{name:'Zweiter Brief für Spieler A',exact:true})});
 await preparedLetter.getByRole('button',{name:'Brief zustellen',exact:true}).click();await a.keyboard.press('Escape');
 await a.getByRole('button',{name:'Brief öffnen: Zweiter Brief für Spieler A',exact:true}).click();await a.getByText('Ein zweiter persönlicher Brief.',{exact:true}).waitFor();
 await gm.screenshot({path:out+'/regie-release.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: A/B isolation, automatic vision, private Escape/close, keyboard letter, reconnect, mobile, reduced motion, multiple independent prepared items.');
}finally{await browser.close();}
