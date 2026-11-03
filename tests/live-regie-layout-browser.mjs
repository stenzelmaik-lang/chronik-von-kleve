import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8922';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});
const screenshots=process.env.CVK_SCREENSHOTS;
if(screenshots)mkdirSync(screenshots,{recursive:true});
const errors=[];
async function account(id,viewport){
 const context=await browser.newContext({viewport});
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
 assert.equal(login.status(),200);
 return context;
}
async function page(context,path){
 const p=await context.newPage();
 p.on('pageerror',error=>errors.push(error.message));
 await p.goto(base+path);
 return p;
}
const tablePath='/spielbereich?bereich=sitzung';
try{
 const gm=await account('command-gm',{width:1440,height:900});
 const player=await account('command-a',{width:390,height:844});
 const status=await (await gm.request.get(base+'/api/live-table?view=active')).json();
 assert.ok(status.room?.started,'The isolated fixture needs an active round');
 const stage=await (await gm.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(status.room.sessionId))).json();
 const playerName=stage.crew.find(person=>person.id==='command-a').name;
 const slTable=await page(gm,tablePath);
 const roster=slTable.getByRole('navigation',{name:'Spielerleiste'});
 await roster.waitFor();
 assert.equal(await roster.getByRole('button',{name:new RegExp(playerName)}).count(),0);
 const playerTable=await page(player,tablePath);
 const playerButton=roster.getByRole('button',{name:new RegExp(playerName)});
 await playerButton.waitFor();
 const popup=playerTable.waitForEvent('popup');
 await playerTable.getByRole('link',{name:/Weltkarte öffnen/}).click();
 const map=await popup;
 await map.waitForURL(/bereich=schauplaetze/);
 await map.locator('.maplibregl-map').first().waitFor({timeout:25000});
 await map.close();
 await playerTable.getByRole('button',{name:'Würfel öffnen'}).waitFor();
 for(const width of [390,1440]){
  await playerTable.setViewportSize({width,height:width===390?844:900});
  const health=playerTable.getByRole('button',{name:/^Zustand von /});
  const pressure=playerTable.getByRole('button',{name:'Stress und Maskerade öffnen'});
  await health.getByText('Blut',{exact:true}).waitFor();
  await health.getByText('Willenskraft',{exact:true}).waitFor();
  await health.getByRole('img',{name:/Blutvorrat \d+ von \d+/}).waitFor();
  await health.getByRole('img',{name:/Willenskraft \d+ von \d+/}).waitFor();
  const [body,stress]=await Promise.all([health.boundingBox(),pressure.boundingBox()]);
  assert.ok(body&&stress&&body.x+body.width<=stress.x,'The player HUD cards stay apart at '+width+'px');
  if(screenshots)await playerTable.screenshot({path:screenshots+'/spieltisch-'+width+'.png'});
  await health.click();
  await playerTable.getByRole('complementary',{name:'Zustände',exact:true}).waitFor();
  await playerTable.getByRole('button',{name:'Werkzeug schließen'}).click();
 }
 await player.close();
 await playerButton.waitFor({state:'hidden',timeout:45000});
 console.log('PASS presence joins and leaves the roster, and world map opens without leaving the table');

 const regie=await page(gm,'/sl/regie');
 const narration=regie.locator('#regie-bereich-narration');
 await narration.waitFor();
 const narrationOrder=async()=>regie.locator('main > [data-area]:not([hidden])').evaluateAll(items=>items.map(item=>item.dataset.area));
 const first=await narrationOrder();
 await narration.getByRole('button',{name:'Erzählung nach hinten verschieben'}).click();
 const next=await narrationOrder();
 assert.equal(next.indexOf('narration'),first.indexOf('narration')+1);
 await narration.getByRole('button',{name:'Erzählung breiter anzeigen'}).click();
 assert.equal(await narration.getAttribute('data-wide'),'true');
 await narration.getByRole('button',{name:'Erzählung ausblenden'}).click();
 await narration.waitFor({state:'hidden'});
 await regie.reload();
 const hiddenMenu=regie.getByText(/Ausgeblendete Kacheln/);
 await hiddenMenu.waitFor();
 await hiddenMenu.click();
 await regie.getByRole('button',{name:'Erzählung einblenden'}).click();
 await narration.waitFor();
 assert.deepEqual(await narrationOrder(),next);
 assert.equal(await narration.getAttribute('data-wide'),'true');
 if(screenshots)await regie.screenshot({path:screenshots+'/regie-layout.png'});
 const body=narration.locator(':scope > header + div');
 await body.scrollIntoViewIfNeeded();
 const beforeResize=await body.boundingBox();
 assert.ok(beforeResize);
 await regie.mouse.move(beforeResize.x+beforeResize.width-4,beforeResize.y+beforeResize.height-4);
 await regie.mouse.down();
 await regie.mouse.move(beforeResize.x+beforeResize.width-4,beforeResize.y+beforeResize.height-64,{steps:6});
 await regie.mouse.up();
 assert.ok((await body.boundingBox()).height<beforeResize.height,'The tile body can be shortened');
 await narration.getByRole('button',{name:'Erzählung im Vollbild öffnen'}).click();
 await regie.locator('#regie-bereich-narration:modal').waitFor();
 if(screenshots)await regie.screenshot({path:screenshots+'/regie-vollbild.png'});
 await regie.keyboard.press('Escape');
 await regie.locator('#regie-bereich-narration:modal').waitFor({state:'hidden'});
 await narration.waitFor();
 await regie.setViewportSize({width:390,height:844});
 assert.equal(await regie.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const ended=await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'end',sessionId:status.room.sessionId,runId:status.room.runId}});
 assert.equal(ended.status(),200);
 await roster.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);
 console.log('PASS Regie reorder, width, hide, restore, reload, fullscreen, Escape and narrow viewport');
}finally{await browser.close();}
