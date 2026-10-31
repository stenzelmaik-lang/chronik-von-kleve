import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
// Stage narration UX (UX-18 to UX-21): long text, no clipping, personal size/reading mode/scroll, no cross-viewer effects.
// Run against an isolated synthetic instance with a started evening: scripts/start-erzaehlung.ps1
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8864';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8830','8852','8864','8870','8874'].includes(new URL(base).port),'Use the isolated synthetic Spieltisch fixture only');
const output='.local-work/ux-check/erzaehlung';mkdirSync(output,{recursive:true});
const viewports=[{name:'1920',viewport:{width:1920,height:1080}},{name:'1440',viewport:{width:1440,height:900}},{name:'zoom125',viewport:{width:1536,height:864},deviceScaleFactor:1.25},{name:'375',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true}];
// CVK_PLAYWRIGHT_CHANNEL=msedge uses an installed browser where no Playwright download exists.
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});const errors=[];let phase='login';
const pass=label=>console.log('PASS '+label);
const end='Ende des synthetischen Vorlesetextes';
const overlaps=(s,d)=>!(s.bottom<=d.top+0.5||s.top>=d.bottom-0.5||s.right<=d.left+0.5||s.left>=d.right-0.5);
try{
 let q='',published=false;
 for(const config of viewports){
  phase=config.name+' login';
  const {name,...options}=config;
  const contexts=await Promise.all(['command-gm','command-a','command-b'].map(async account=>{
   const context=await browser.newContext(options);
   const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:account+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(login.status(),200);return context;
  }));
  const [gm,a,b]=contexts;
  const get=async(context,path)=>{const r=await context.request.get(base+path);assert.equal(r.status(),200);return r.json();};
  if(!q){
   const active=await get(gm,'/api/live-table?view=active');assert.ok(active.room?.started,'Start the synthetic evening first');
   q='/api/live-stage?sessionId='+encodeURIComponent(active.room.sessionId);
   const state=await get(gm,q);
   if(state.sceneEventId)await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideScene',sessionId:active.room.sessionId,runId:active.room.runId,eventId:state.sceneEventId}});
  }
  const pages=await Promise.all(contexts.map(async c=>{const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(name+': '+e.message));await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Notizzettel',exact:true}).waitFor();return p;}));
  const [sl,pa,pb]=pages;
  const region=p=>p.getByRole('region',{name:'Freigegebene Erzählung',exact:true});
  const body=p=>region(p).getByLabel(/^Erzähltext:/);
  if(!published){
   phase='publish';
   await sl.getByRole('button',{name:'Szenen des Abends',exact:true}).click();
   await sl.getByRole('complementary',{name:'Szenen des Abends',exact:true}).getByRole('button',{name:'Erzählung zeigen',exact:true}).first().click();
   await sl.getByRole('button',{name:'Werkzeug schließen',exact:true}).click();published=true;
  }
  for(const p of pages)await region(p).getByRole('heading',{name:'Ankunft am Tor',exact:true}).waitFor();
  for(const viewer of [a,b])assert.ok(!JSON.stringify(await get(viewer,q)).includes('SL_PRIVATE_SECRET'),'Players never receive GM secrets');

  phase=name+' geometry';
  for(const [role,p] of [['sl',sl],['a',pa],['b',pb]]){
   const geometry=await p.evaluate(()=>{
    const box=e=>e?.getBoundingClientRect().toJSON();
    const section=document.querySelector('[aria-label="Freigegebene Erzählung"]'),scroller=section.querySelector('[aria-label^="Erzähltext:"]');
    const stage=document.querySelector('main[aria-label="Dynamische Spielbühne"]'),status=[...stage.children].find(e=>e.textContent==='Gemeinsame Bühne');
    return {page:document.documentElement.scrollWidth-innerWidth,section:box(section),stage:box(stage),status:box(status),title:box(section.querySelector('h2')),scroller:box(scroller),scroll:{h:scroller.scrollHeight,c:scroller.clientHeight,w:scroller.scrollWidth-scroller.clientWidth},docks:[...document.querySelectorAll('nav[aria-label="Spielaktionen"],button[aria-label*="Zust"],button[aria-label="Kontext öffnen"],main>button[aria-label="Regie öffnen"]')].map(box).filter(r=>r.width&&r.left>=box(stage).left)};
   });
   await p.screenshot({path:`${output}/${name}-${role}-kompakt.png`});
   assert.ok(geometry.page<=0,role+': no horizontal page overflow');
   assert.equal(geometry.scroll.w,0,role+': no horizontal narration overflow');
   assert.ok(geometry.section.left>=geometry.stage.left&&geometry.section.right<=geometry.stage.right+0.5&&geometry.section.bottom<=geometry.stage.bottom+0.5,role+': narration stays within the stage');
   assert.ok(geometry.section.top>=geometry.status.bottom-0.5,role+': stage status label no longer covers the narration');
   assert.ok(geometry.scroller.top>=geometry.title.bottom-0.5,role+': header and title never overlay the text');
   for(const dock of geometry.docks)assert.ok(!overlaps(geometry.section,dock),role+': stage controls and HUD docks do not cover narration '+JSON.stringify({section:geometry.section,dock}));
   assert.ok(geometry.scroll.h>geometry.scroll.c,role+': long text scrolls inside the narration');
   assert.ok(geometry.section.height>=Math.min(geometry.stage.height*0.5,geometry.scroll.h),role+': reading area uses the available height ('+Math.round(geometry.section.height)+' of '+Math.round(geometry.stage.height)+')');
  }
  pass(name+': reading area large, inside the stage, nothing overlaid, no horizontal overflow');

  phase=name+' isolated scroll';
  const posts=[];pa.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());});
  await body(pa).hover();for(let i=0;i<40;i++)await pa.mouse.wheel(0,400);
  await pa.waitForFunction(()=>{const n=document.querySelector('[aria-label^="Erzähltext:"]');return n.scrollTop>=n.scrollHeight-n.clientHeight-2;});
  const last=await pa.getByText(end).evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('[aria-label^="Erzähltext:"]').getBoundingClientRect();return r.top>=s.top-0.5&&r.bottom<=s.bottom+0.5;});
  assert.ok(last,'The final line is fully visible at the end of the scroll range');
  await pa.waitForTimeout(400);
  assert.deepEqual(posts.filter(u=>!u.includes('/presence')),[],'Scrolling sends nothing to the server');
  for(const p of [sl,pb])assert.equal(await body(p).evaluate(n=>n.scrollTop),0,'Other viewers keep their own position');
  pass(name+': player A reads to the end; GM and player B stay where they are, nothing is sent');

  phase=name+' personal size and reading mode';
  const size=p=>body(p).locator('div').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));
  const before=await size(pb);await region(pa).getByRole('button',{name:'Erzählschrift vergrößern',exact:true}).click();await region(pa).getByRole('button',{name:'Erzählschrift vergrößern',exact:true}).click();
  assert.ok(await size(pa)>before*1.25);assert.equal(await size(pb),before);
  const compact=await region(pa).boundingBox();
  await region(pa).getByRole('button',{name:'Erzählung im Lesemodus vergrößern',exact:true}).click();
  const wide=await region(pa).boundingBox(),stage=await pa.getByRole('main',{name:'Dynamische Spielbühne',exact:true}).boundingBox();
  assert.ok(wide.height>=compact.height-1&&wide.width>=compact.width-1&&wide.y+wide.height<=stage.y+stage.height+0.5);
  await pa.waitForFunction(()=>![...document.querySelectorAll('button[aria-label*="Zust"]')].some(e=>e.getBoundingClientRect().left>=56));
  await pa.screenshot({path:`${output}/${name}-a-lesemodus.png`});
  const covered=await pa.evaluate(selector=>{const s=document.querySelector('[aria-label="Freigegebene Erzählung"]').getBoundingClientRect().toJSON();return [...document.querySelectorAll(selector)].map(e=>({label:e.getAttribute('aria-label'),...e.getBoundingClientRect().toJSON()})).filter(d=>d.width&&d.left>=56).map(d=>({...d,section:s}));},'nav[aria-label="Spielaktionen"],button[aria-label*="Zust"],button[aria-label="Kontext öffnen"],main>button[aria-label="Regie öffnen"]').then(list=>list.filter(d=>overlaps(d.section,d)));
  assert.deepEqual(covered,[],'Reading mode leaves stage controls and docks uncovered');
  assert.ok(await body(pa).evaluate(n=>n.scrollTop>0),'Reading position survives the size and mode change');
  assert.equal(await region(pb).getAttribute('data-expanded'),'false');
  pass(name+': font size and reading mode are personal');

  phase=name+' reload';
  const ratio=await body(pa).evaluate(n=>n.scrollTop/(n.scrollHeight-n.clientHeight));
  await pa.reload();await region(pa).getByRole('heading',{name:'Ankunft am Tor',exact:true}).waitFor();
  assert.equal(await region(pa).getAttribute('data-expanded'),'true');assert.ok(await size(pa)>before*1.25);
  const restored=await body(pa).evaluate(n=>n.scrollTop/(n.scrollHeight-n.clientHeight));assert.ok(Math.abs(restored-ratio)<0.05,'Scroll position restored: '+restored+' vs '+ratio);
  pass(name+': size, reading mode and scroll position survive reload for this person only');

  if(name==='1920'){
   phase='GM reading mode';
   await region(sl).getByRole('button',{name:'Erzählung im Lesemodus vergrößern',exact:true}).click();await body(sl).evaluate(n=>{n.scrollTop=n.scrollHeight;});
   assert.ok(await sl.getByText(end).isVisible());await sl.screenshot({path:`${output}/${name}-sl-lesemodus.png`});
   assert.equal(await body(pb).evaluate(n=>n.scrollTop),0);assert.equal(await region(pb).getAttribute('data-expanded'),'false');
   pass('GM reads the whole text aloud in reading mode without moving any player view');
  }
  await Promise.all(contexts.map(c=>c.close()));
 }
 assert.deepEqual(errors,[]);
 console.log('ALL PASS: Erzählung UX-18 bis UX-21');
}catch(error){console.error('FAILED in phase '+phase);throw error;}
finally{await browser.close();}
