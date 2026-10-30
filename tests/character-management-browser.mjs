import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
// Browser acceptance for Spieler- und Charakterverwaltung 3.0 against the isolated
// synthetic instance (scripts/start-charakter-3.ps1). Never against production.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8846';
assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).port,'8846','Only the isolated synthetic character fixture');
const output='.local-work/character-3/browser';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CVK_PLAYWRIGHT_CHANNEL?{channel:process.env.CVK_PLAYWRIGHT_CHANNEL}:{})}),checks=[],errors=[];let phase='setup',page;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
const fits=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
try{
  const [gm,a,b]=await Promise.all(['command-gm','command-a','command-b'].map(async name=>{const c=await browser.newContext({viewport:{width:1440,height:1000}});const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:name+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(r.status(),200);return c;}));
  const get=async(context,path)=>{const r=await context.request.get(base+path);assert.equal(r.status(),200,await r.text());return r.json();};
  const post=async(context,path,data)=>{const r=await context.request.post(base+path,{headers:{Origin:base},data});assert.equal(r.status(),200,await r.text());return r.json();};
  const title='SYNTHETISCH – Bestandsbogen '+Date.now();
  const {id}=await post(a,'/api/records',{kind:'charaktere',title,visibility:'private',body:{clan:'Toreador',attributes:{Geschick:6},skills:{'Historische Fähigkeit':6},disciplines:[{name:'Auspex',value:1}],virtues:{Überzeugung:3,Instinkt:3,Mut:4},humanity:6,willpower:5,bloodMax:11,bloodPerRound:1,concept:'Synthetischer Bestandscharakter'}});
  page=await gm.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const card=()=>page.getByRole('article').filter({hasText:title});
  const openProfile=async()=>{await page.goto(base+'/sl/command-center?bereich=charaktere');await page.getByRole('button',{name:/Demo Spieler A/}).click();await card().waitFor();};

  phase='profile and sheet';await openProfile();
  assert.ok((await card().innerText()).includes('Noch nicht übernommen'));
  await card().getByRole('button',{name:'Bogen ansehen'}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.getByRole('group',{name:'Geschick',exact:true}).getByRole('button',{pressed:true}).count(),6);
  assert.equal(await page.getByRole('group',{name:'Auspex',exact:true}).getByRole('button',{pressed:true}).count(),1);
  assert.equal(await page.getByRole('group',{name:'Überzeugung',exact:true}).getByRole('button',{pressed:true}).count(),3);
  pass('SL opens the player profile and the dossier; values above five, disciplines and alternative virtues show as dots');

  phase='editor cancel';await page.getByRole('tab',{name:'Verwaltung',exact:true}).click();
  await page.getByRole('button',{name:'Bogen bearbeiten',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Charaktername',{exact:true}).fill(title+' UNSAVED');await dialog.getByRole('button',{name:'Abbrechen',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal((await get(gm,'/api/character-engine?id='+id)).title,title);pass('Cancel discards an SL sheet edit without a write');

  phase='editor save';await page.getByRole('button',{name:'Bogen bearbeiten',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Geschick auf 7 setzen'}).click();await dialog.getByRole('button',{name:'Historische Fähigkeit auf 7 setzen'}).click();
  await dialog.getByRole('button',{name:'Hintergrund hinzufügen'}).click();await dialog.getByLabel('Hintergrund 1 Name',{exact:true}).fill('Status');
  await dialog.getByLabel('Grund der Bogenänderung',{exact:true}).fill('Synthetische Übernahme vom Papierbogen');
  await dialog.getByRole('button',{name:'Bogen speichern',exact:true}).click();await dialog.waitFor({state:'detached'});
  let engine=await get(gm,'/api/character-engine?id='+id);assert.equal(engine.sheet.attributes.Geschick,7);assert.equal(engine.sheet.skills['Historische Fähigkeit'],7);assert.deepEqual(engine.sheet.backgrounds,[{name:'Status',value:1}]);assert.equal(engine.deviation.lines.find(l=>l.key==='attributes:Körperliche Attribute').spent,6);
  pass('SL sets values by clicking dots (including above five), adds a background and saves with a reason; no creation budget blocks it');

  phase='permissions';await page.getByRole('switch',{name:'Spieler darf Bogen bearbeiten'}).click();await page.getByRole('radio',{name:'Steigerung beantragen'}).click();
  await page.getByLabel('Grund der Rechteänderung',{exact:true}).fill('Nachtrag freigegeben');await page.getByRole('button',{name:'Speichern',exact:true}).click();
  await page.getByRole('switch',{name:'Spieler darf Bogen bearbeiten',checked:true}).waitFor();
  engine=await get(gm,'/api/character-engine?id='+id);assert.deepEqual([engine.permissions.editing,engine.permissions.development],[true,'approval']);pass('SL opens catch-up editing and sets development to requests for this character only');

  phase='player catch-up';await a.request.patch(base+'/api/character-selection',{headers:{Origin:base},data:{characterId:id}});
  const player=await a.newPage();player.setDefaultTimeout(15000);player.on('pageerror',e=>errors.push(e.message));player.on('dialog',d=>d.accept());
  await player.goto(base+'/spielbereich?bereich=charaktere');await player.getByRole('heading',{name:title,exact:true}).waitFor();
  await player.getByRole('tab',{name:'Entwicklung',exact:true}).click();await player.getByRole('button',{name:/Nachtrag fertig/}).waitFor();await player.getByRole('button',{name:'Bogen bearbeiten',exact:true}).last().click();
  dialog=player.getByRole('dialog');await dialog.getByLabel('Konzept',{exact:true}).fill('Nachgetragenes Konzept');await dialog.getByLabel('Grund der Bogenänderung',{exact:true}).fill('Werte vom Papierbogen');
  await dialog.getByRole('button',{name:'Bogen speichern',exact:true}).click();await dialog.waitFor({state:'detached'});
  await player.getByRole('button',{name:/Nachtrag fertig/}).click();await player.getByText(/Nachtrag gemeldet/).waitFor();
  engine=await get(gm,'/api/character-engine?id='+id);assert.equal(engine.sheet.concept,'Nachgetragenes Konzept');assert.equal(typeof engine.catchUpReadyAt,'string');
  const own=await get(a,'/api/character-engine?id='+id);assert.equal(own.historicalSource,null);assert.equal(own.gmNotes,undefined);assert.equal(await player.getByText('Verwaltung der Akte').count(),0);
  pass('Player A catches up the sheet without budgets, reports it, and sees no SL data or controls');

  phase='adoption';await openProfile();assert.ok((await card().innerText()).includes('Nachtrag abgeschlossen'));
  await card().getByRole('button',{name:'Verwalten'}).click();await page.getByRole('heading',{name:'Bestehenden Charakter übernehmen'}).waitFor();
  await page.getByLabel('Historische verfügbare XP',{exact:true}).fill('20');await page.getByLabel('Quelle der Übernahme',{exact:true}).fill('Synthetischer Papierbogen');await page.getByLabel('Grund der Bestandsübernahme',{exact:true}).fill('Synthetische Übernahme, Summen unbekannt');
  await page.getByRole('button',{name:'Bestand übernehmen und freigeben',exact:true}).click();await page.getByText('Freigegeben',{exact:true}).waitFor();
  engine=await get(gm,'/api/character-engine?id='+id);assert.equal(engine.state,'confirmed');assert.equal(engine.permissions.editing,false);assert.equal(engine.xp.available,20);assert.equal(engine.xp.received,null);
  pass('One SL step adopts the caught-up sheet, books 20 historical XP once, releases it for play and closes editing');

  phase='xp';await page.getByLabel('XP-Gutschrift',{exact:true}).fill('5');await page.getByLabel('Grund der XP-Gutschrift',{exact:true}).fill('Synthetischer Spielabend');await page.getByRole('button',{name:'5 XP gutschreiben',exact:true}).click();
  await page.getByText('Vergabe durch SL').waitFor();engine=await get(gm,'/api/character-engine?id='+id);assert.equal(engine.xp.available,25);
  await page.getByRole('tab',{name:'Korrigieren'}).click();await page.getByLabel('XP-Gegenbuchung',{exact:true}).selectOption({index:1});await page.getByLabel('Grund der XP-Korrektur',{exact:true}).fill('Doppelt gebucht');await page.getByRole('button',{name:'Korrektur buchen',exact:true}).click();
  await page.locator('[aria-label="Erfahrungspunkte"]').getByText('20',{exact:true}).waitFor();engine=await get(gm,'/api/character-engine?id='+id);assert.equal(engine.xp.available,20);assert.equal(engine.ledger.length,3);
  pass('SL awards XP and reverses that award once; the ledger keeps every booking');

  phase='player b';const foreign=await b.request.get(base+'/api/character-engine?id='+id);assert.equal(foreign.status(),404);
  const bPage=await b.newPage();bPage.on('pageerror',e=>errors.push(e.message));await bPage.goto(base+'/spielbereich?bereich=charaktere');await bPage.waitForTimeout(2500);assert.equal(await bPage.getByText(title).count(),0);
  pass('Player B can neither read nor see the foreign dossier');

  phase='responsive';for(const [width,height] of [[1440,900],[375,812]]){await page.setViewportSize({width,height});await openProfile();assert.ok(await fits(page));await page.screenshot({path:output+'/profiles-'+width+'.png',fullPage:false,animations:'disabled'});
    await card().getByRole('button',{name:'Verwalten'}).click();await page.getByRole('button',{name:'Bogen bearbeiten',exact:true}).click();dialog=page.getByRole('dialog');
    assert.ok(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.right<=innerWidth+1&&r.x>=-1&&r.bottom<=innerHeight+1&&r.y>=-1;}));
    assert.ok(await dialog.getByRole('button',{name:'Bogen speichern',exact:true}).isVisible());await page.screenshot({path:output+'/editor-'+width+'.png',fullPage:false,animations:'disabled'});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.ok(await fits(page));pass('Profiles, administration and editor fit '+width+'px; save stays visible; Escape closes');}
  assert.deepEqual(errors,[]);writeFileSync(output+'/result.json',JSON.stringify({checks,errors,base},null,2));
}catch(error){if(page){console.error('PHASE '+phase);await page.screenshot({path:output+'/failure.png',fullPage:true,animations:'disabled'}).catch(()=>{});}throw error;}finally{await browser.close();}
