import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Whiteboard 2 in real browsers (docs/spieltisch-2-0/Whiteboard-2.md): SL and Spieler A on desktop, Spieler B on a 375 px touch phone.
// Draws a straight–curve–straight stroke and checks it stays identical over many polls, syncs it to the other browsers,
// erases, locks and clears for everybody, and writes screenshots. Run against the --ultio-pager fixture on its own port.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8897';
assert.equal(new URL(base).hostname,'127.0.0.1');
const output='.local-work/ux-check/whiteboard-2';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];
const pass=label=>console.log('PASS '+label);
async function open(id,options){const context=await browser.newContext(options);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(id+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|409|423/.test(m.text()))errors.push(id+' console: '+m.text());});await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Gemeinsam zeichnen'}).waitFor();return {id,context,p,layer:p.locator('[data-layer=annotation]'),svg:p.locator('[data-layer=annotation] svg[role=application]')};}
const desktop={viewport:{width:1440,height:900}};
const gm=await open('command-gm',desktop),a=await open('command-a',{viewport:{width:1920,height:1080}}),b=await open('command-b',{viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const room=(await (await gm.context.request.get(base+'/api/live-table?view=active')).json()).room;
const stageApi=async()=>(await gm.context.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId)+'&catalog=1')).json();
// A backdrop on the stage, so the sketch is checked as a marking layer over the scene image.
{const s=await stageApi();const scene=[...s.scenes,...(s.moreScenes||[])][0];if(scene&&!s.backdrop){const r=await gm.context.request.post(base+'/api/live-stage',{headers:{Origin:base},data:{sessionId:room.sessionId,runId:s.runId,expectedVersion:s.version,command:{action:'activateScene',sceneId:scene.id}}});console.log('scene start for backdrop:',r.status());}}
const elements=async u=>u.layer.locator('[data-element-id]').count();
const sketch=async u=>{await u.p.getByRole('button',{name:'Gemeinsam zeichnen'}).click();await u.p.getByRole('toolbar',{name:'Zeichenwerkzeuge'}).waitFor();};
for(const u of [gm,a,b])await sketch(u);
// Start empty.
if(await gm.p.getByRole('button',{name:'Für alle löschen'}).isEnabled()){await gm.p.getByRole('button',{name:'Für alle löschen'}).click();await gm.p.getByRole('dialog',{name:'Skizze für alle löschen'}).getByRole('button',{name:'Für alle löschen'}).click();}
await a.p.waitForTimeout(2500);assert.equal(await elements(a),0);

// 1 Draw straight → half circle → straight with the pen (default tool) in A's browser.
const box=await a.layer.boundingBox(),at=(x,y)=>[box.x+x*box.width,box.y+y*box.height];
const path=[];for(let i=0;i<=150;i++)path.push([.3+i*.0015,.3]);for(let i=1;i<=150;i++){const t=i/150*Math.PI;path.push([.525+.08*Math.sin(t),.4-.1*Math.cos(t)]);}for(let i=1;i<=150;i++)path.push([.525-i*.0015,.5]);
await a.p.mouse.move(...at(...path[0]));await a.p.mouse.down();for(const q of path.slice(1))await a.p.mouse.move(...at(...q));
const live=await a.layer.locator('[data-element-id] path').last().getAttribute('d');
await a.p.mouse.up();
const read=u=>u.layer.locator('[data-element-id] path:not([stroke=transparent])').evaluateAll(ps=>ps.map(p=>p.getAttribute('d')));
await a.p.waitForTimeout(500);const first=await read(a);assert.equal(first.length,1,'one stroke');
// The start of the stroke never changes while drawing went on (old code thinned it at 128 points).
const start=d=>d.match(/^M([\d.]+) ([\d.]+)/).slice(1).map(Number);assert.ok(Math.hypot(start(first[0])[0]-start(live)[0],start(first[0])[1]-start(live)[1])<1,'the stroke starts where it started while drawing');
const samples=[];for(let i=0;i<5;i++){await a.p.waitForTimeout(1300);samples.push((await read(a))[0]);}
assert.ok(samples.every(d=>d===samples[0]),'the stroke stays identical over 5 polls (6.5 s)');
// Geometry on the server matches what was drawn.
const stored=(await (await a.context.request.get(base+'/api/live-table?view=active')).json()).room.elements[0];
const ctm=await a.svg.evaluate(s=>{const m=s.getScreenCTM().inverse();return [m.a,m.b,m.c,m.d,m.e,m.f];});
const ideal=path.map(q=>{const [x,y]=at(...q);return [ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]];});
const seg=(p,u,v)=>{const dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy;const t=l?Math.max(0,Math.min(1,((p[0]-u[0])*dx+(p[1]-u[1])*dy)/l)):0;return Math.hypot(p[0]-u[0]-t*dx,p[1]-u[1]-t*dy);};
const worst=Math.max(...ideal.map(q=>Math.min(...stored.points.slice(1).map((v,i)=>seg(q,stored.points[i],v)))));
assert.ok(worst<2,'stored stroke follows the drawn curve: '+worst.toFixed(2));
pass(`defect 3: curve stays stable in A's browser and on the server (max deviation ${worst.toFixed(2)} units, ${stored.points.length} points)`);

// 2 Sync to the other browsers, same geometry.
await gm.p.waitForFunction(()=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===1,null,{timeout:6000});
await b.p.waitForFunction(()=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===1,null,{timeout:6000});
assert.equal((await read(gm))[0],first[0],'SL renders the identical path');
pass('the stroke reaches SL (desktop) and B (phone) within one poll, unchanged');

// 3 B draws on the phone; quick successive strokes by A all arrive; nothing vanishes.
const pbox=await b.layer.boundingBox();await b.p.mouse.move(pbox.x+pbox.width*.3,pbox.y+pbox.height*.6);await b.p.mouse.down();for(let i=1;i<=30;i++)await b.p.mouse.move(pbox.x+pbox.width*(.3+i*.01),pbox.y+pbox.height*(.6+Math.sin(i/4)*.05));await b.p.mouse.up();
for(let i=0;i<4;i++){await a.p.mouse.move(...at(.15,.2+i*.05));await a.p.mouse.down();for(let k=1;k<=10;k++)await a.p.mouse.move(...at(.15+k*.01,.2+i*.05+k*.003));await a.p.mouse.up();}
assert.ok(await elements(a)>=5,'A sees its quick strokes at once');
for(const u of [gm,a,b])await u.p.waitForFunction(()=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===6,null,{timeout:8000});
await a.p.waitForTimeout(3000);for(const u of [gm,a,b])assert.equal(await elements(u),6,u.id+' still sees all 6 strokes after more polls');
pass('defect 2: 6 strokes from two browsers arrive everywhere and none disappears');

// Arrow, shape and note for the screenshot of a marked scene.
await gm.p.getByRole('button',{name:'Pfeil oder Linie'}).click();await gm.p.getByRole('button',{name:'Farbe Blutrot'}).click();
const g=await gm.layer.boundingBox(),gat=(x,y)=>[g.x+x*g.width,g.y+y*g.height];
await gm.p.mouse.move(...gat(.62,.7));await gm.p.mouse.down();await gm.p.mouse.move(...gat(.7,.6),{steps:8});await gm.p.mouse.move(...gat(.78,.45),{steps:8});await gm.p.mouse.up();
await gm.p.getByRole('button',{name:'Form: Rechteck oder Kreis'}).click();await gm.p.getByRole('button',{name:'Kreis',exact:true}).click();
await gm.p.mouse.move(...gat(.76,.3));await gm.p.mouse.down();await gm.p.mouse.move(...gat(.86,.46),{steps:8});await gm.p.mouse.up();
await gm.p.getByRole('button',{name:'Notiz schreiben'}).click();await gm.p.mouse.click(...gat(.66,.22));await gm.p.getByRole('textbox',{name:'Notiz auf der Skizze'}).fill('Hier liegt der Zugang');await gm.p.keyboard.press('Enter');
await gm.p.getByRole('button',{name:'Pfeil oder Linie'}).click();
await gm.p.waitForTimeout(2500);assert.equal(await elements(gm),9);
await gm.p.screenshot({path:output+'/desktop-sl-1440.png'});await a.p.screenshot({path:output+'/desktop-a-1920.png'});
await b.p.waitForFunction(()=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===9,null,{timeout:8000});await b.p.screenshot({path:output+'/handy-b-375.png'});
pass('arrow, circle and note by the SL; screenshots written');

// 4 Players delete only their own strokes: A's eraser does not touch the SL's arrow; "Meine löschen" removes B's stroke for everybody.
await a.p.getByRole('button',{name:'Radierer'}).click();
await a.p.mouse.move(...at(.1,.2));await a.p.mouse.down();for(let k=1;k<=20;k++)await a.p.mouse.move(...at(.1+k*.006,.2+k*.012));await a.p.mouse.up();
const afterErase=await elements(a);assert.ok(afterErase<9&&afterErase>=5,'A erased own quick strokes: '+afterErase);
await a.p.mouse.move(...gat(.62,.7));const arrowStill=await elements(a);
await b.p.getByRole('button',{name:'Meine löschen'}).click();
for(const u of [gm,a])await u.p.waitForFunction(n=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===n,arrowStill-1,{timeout:8000});
pass('eraser and "Meine löschen" remove own strokes for everybody; the SL\'s marks stay');

// 5 Lock: players cannot draw, see why.
await gm.p.getByRole('button',{name:'Sperren'}).click();
await a.p.getByText('Von der SL gesperrt').waitFor({timeout:6000});assert.equal(await a.p.getByRole('button',{name:'Stift',exact:true}).isDisabled(),true);
await a.p.screenshot({path:output+'/desktop-a-gesperrt.png'});
await gm.p.getByRole('button',{name:'Freigeben'}).click();await a.p.getByRole('button',{name:'Stift',exact:true}).and(a.p.locator(':enabled')).waitFor({timeout:6000});
pass('the SL locks and unlocks the sketch; players see it');

// 6 Defect 1: clear for everybody with confirmation.
await gm.p.getByRole('button',{name:'Für alle löschen'}).click();const dialog=gm.p.getByRole('dialog',{name:'Skizze für alle löschen'});await dialog.waitFor();
await gm.p.screenshot({path:output+'/desktop-sl-bestaetigung.png'});
await dialog.getByRole('button',{name:'Abbrechen'}).click();await gm.p.waitForTimeout(1600);assert.ok(await elements(gm)>0,'cancel keeps the sketch');
await gm.p.getByRole('button',{name:'Für alle löschen'}).click();await dialog.getByRole('button',{name:'Für alle löschen'}).click();
for(const u of [gm,a,b])await u.p.waitForFunction(()=>document.querySelectorAll('[data-layer=annotation] [data-element-id]').length===0,null,{timeout:8000});
pass('defect 1: "Für alle löschen" asks first and empties the sketch for SL, A and B');

// 7 Phone layout: tools reachable, nothing outside the screen.
const tb=await b.p.getByRole('toolbar',{name:'Zeichenwerkzeuge'}).boundingBox();assert.ok(tb.x>=0&&tb.x+tb.width<=375&&tb.y+tb.height<=812,'phone dock inside the screen');
await b.p.screenshot({path:output+'/handy-b-leer.png'});assert.equal(await b.p.getByRole('button',{name:'Würfel öffnen'}).count(),0,'dice button out of the way while sketching');
await gm.p.getByTitle('Zeichenmodus schließen (Esc)').click();await gm.p.getByRole('toolbar',{name:'Zeichenwerkzeuge'}).waitFor({state:'hidden'});await gm.p.getByRole('button',{name:'Würfel öffnen'}).waitFor();
pass('phone dock fits; closing the drawing mode hides the tools');

assert.deepEqual(errors,[],'no page errors');
await browser.close();console.log('Whiteboard browser: all checks passed. Screenshots in '+output);
