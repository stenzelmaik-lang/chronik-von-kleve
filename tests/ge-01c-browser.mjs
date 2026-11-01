import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
// GE-01C: real browser walk-through of character checks with SL, player A and player B against the synthetic --ge-01 instance.
// Screenshots come straight from the tested build. Never points at a remote site.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8898';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const output=process.env.CVK_SHOTS||'docs/qa/ge-01c';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined,args:['--enable-unsafe-swiftshader']});
const errors=[],evidence={base};let phase='login';
const pass=label=>console.log('PASS '+label);
const shot=(page,name)=>page.screenshot({path:output+'/'+name+'.jpg',type:'jpeg',quality:82,animations:'disabled'});
try{
 const context=async(account,options={viewport:{width:1440,height:900}})=>{const c=await browser.newContext(options);const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:account+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(r.status(),200,account);return c;};
 const [gmC,aC,bC]=await Promise.all(['command-gm','command-a','command-b'].map(x=>context(x)));
 const get=async(c,path)=>{const r=await c.request.get(base+path);assert.equal(r.status(),200,path);return r.json();};
 const active=(await get(gmC,'/api/live-table?view=active')).room;assert.ok(active?.started,'synthetic evening must be started');
 const q='/api/live-stage?sessionId='+encodeURIComponent(active.sessionId);
 for(const [c,title] of [[aC,'SYNTHETISCH – Regiecharakter A'],[bC,'SYNTHETISCH – Regiecharakter B']]){const own=(await get(c,'/api/records?kind=charaktere')).records.find(x=>x.title===title);assert.ok(own,title);assert.equal((await c.request.patch(base+'/api/character-selection',{headers:{Origin:base},data:{characterId:own.id}})).status(),200);}
 const open=async(c,who)=>{const page=await c.newPage();page.on('pageerror',e=>errors.push(who+': '+e.message));await page.goto(base+'/');await page.getByRole('button',{name:'Spieltisch betreten'}).click();await page.getByRole('button',{name:'Würfel öffnen'}).waitFor({timeout:30000});return page;};
 const reenter=async page=>{await page.reload();const enter=page.getByRole('button',{name:'Spieltisch betreten'}),dice=page.getByRole('button',{name:'Würfel öffnen'});await enter.or(dice).first().waitFor({timeout:30000});if(await enter.isVisible())await enter.click();await dice.waitFor({timeout:30000});};
 const [gm,a,b]=await Promise.all([open(gmC,'SL'),open(aC,'A'),open(bC,'B')]);
 const rollsBefore=(await get(gmC,q)).dice.events.length;

 phase='SL issues a prepared check from the Regie window';
 const popup=gm.waitForEvent('popup');await gm.getByRole('button',{name:'Regie im zweiten Fenster'}).click();const regie=await popup;regie.on('pageerror',e=>errors.push('Regie: '+e.message));
 await regie.setViewportSize({width:1440,height:900});
 const probenTab=regie.locator('[data-area-button=checks]');await probenTab.waitFor({timeout:20000});
 assert.match((await probenTab.innerText()).trim(),/^Proben/,'Proben area visible in the area bar');
 const badge=async()=>{const el=regie.locator('[data-area-button=checks] [class*=areaBadge]');return await el.count()?Number(await el.innerText()):0;};const owedBefore=await badge();
 await probenTab.click();
 const form=regie.getByRole('region',{name:'Neue Probe'});await form.waitFor();
 await form.getByRole('button',{name:'Schlüsselbund stehlen'}).click();
 assert.equal(await form.getByLabel('Attribut',{exact:true}).inputValue(),'dexterity');assert.equal(await form.getByLabel('Fähigkeit',{exact:true}).inputValue(),'larceny');assert.equal(await form.getByLabel('SG',{exact:true}).inputValue(),'7');
 pass('prepared check fills Geschick + Diebstahl, SG 7 with one click');
 await form.getByRole('button',{name:/^Demo Spieler A/}).click();
 await shot(regie,'01-regie-proben-vorbereitet');
 await form.getByRole('button',{name:'Probe ausgeben'}).click();
 await form.getByText('„Schlüsselbund stehlen“ ist ausgegeben.').waitFor({timeout:15000});
 await regie.getByRole('list',{name:'Ausgegebene Proben'}).getByText('Probe ausstehend').first().waitFor();
 assert.equal(await badge(),owedBefore+1,'badge counts the new owed roll');
 await shot(regie,'02-regie-probe-ausgegeben');
 pass('issued check shows as "Probe ausstehend" with badge 1 in the Regie');

 phase='player A gets one calm notice and opens the own sheet from the top bar';
 const notice=a.getByRole('status').filter({hasText:'Neue Charakterprobe'});await notice.waitFor({timeout:20000});
 assert.match(await notice.innerText(),/Schlüsselbund stehlen/);
 assert.doesNotMatch(await a.locator('body').innerText(),/GE-0?1|[0-9a-f]{6,}-[0-9a-f]{4}/,'no internal ids on the player table');
 await a.locator('[class*=ownHint]').waitFor();assert.equal((await a.locator('[class*=ownHint]').innerText()).trim(),'Probe ausstehend');
 assert.equal(await b.getByRole('status').filter({hasText:'Neue Charakterprobe'}).count(),0,'unaddressed player B gets no notice');
 await shot(a,'03-spieler-neue-probe');
 await notice.getByRole('button',{name:'Würfeln'}).click();
 const panel=a.getByRole('region',{name:'Charakterprobe'});await panel.waitFor({timeout:15000});
 assert.equal(await a.locator('[data-participant-menu]').count(),1,'check lives in the own character-sheet drawer');
 assert.equal(await notice.count(),0,'notice disappears after reading');
 const attr=panel.getByRole('button',{name:/^Geschick \d+, von der Spielleitung vorgegeben/});
 assert.equal(await attr.getAttribute('aria-pressed'),'false');assert.ok(await panel.getByRole('button',{name:'Werte im Bogen wählen'}).isDisabled(),'no roll before confirming');
 await attr.click();assert.equal(await attr.getAttribute('aria-pressed'),'true');
 await panel.getByRole('tab',{name:'Fähigkeiten'}).click();
 const ability=panel.getByRole('button',{name:/^Diebstahl \d+, von der Spielleitung vorgegeben/});await ability.click();assert.equal(await ability.getAttribute('aria-pressed'),'true');
 const rollButton=panel.getByRole('button',{name:'Würfeln',exact:true});await rollButton.waitFor({timeout:15000});await a.waitForFunction(()=>/\d+ W10/.test(document.querySelector('[aria-label="Aktive Charakterprobe"]')?.textContent||''));
 const shownPool=Number(/(\d+) W10/.exec(await panel.getByRole('group',{name:'Aktive Charakterprobe'}).innerText())[1]);
 const preview=await (await aC.request.post(base+'/api/w10-preview',{headers:{Origin:base},data:{sessionId:active.sessionId,characterId:(await get(aC,'/api/character-selection')).characterId,selection:{attributeId:'dexterity',abilityId:'larceny'},declared:{baseDifficulty:7}}})).json();
 assert.equal(shownPool,preview.pool.effective,'shown pool is the server pool');evidence.pool=shownPool;evidence.difficulty=preview.difficulty.effective;
 await shot(a,'04-spieler-bogen-auswahl-pool');
 pass('player confirms both GM traits in the own sheet; server pool '+shownPool+' W10 shown before rolling');

 phase='player A rolls once; SL and player see the same stored roll';
 await rollButton.click();
 const effect=a.getByRole('region',{name:'Gemeinsamer Würfelwurf'});await effect.waitFor({timeout:20000});
 await a.getByRole('button',{name:'Würfelanimation überspringen'}).click().catch(()=>{});
 await a.locator('[data-phase=settled],[data-phase=fallback]').waitFor({timeout:30000});
 const afterRoll=await get(gmC,q),check=afterRoll.checks.findLast(c=>c.title==='Schlüsselbund stehlen'),stored=afterRoll.dice.events.filter(e=>e.checkRef?.requestId===check.id);
 assert.equal(stored.length,1,'exactly one roll');assert.equal(stored[0].roll.pool,shownPool);assert.equal(afterRoll.dice.events.length,rollsBefore+1);
 evidence.faces=stored[0].roll.dice;evidence.outcome=stored[0].result.outcome;evidence.net=stored[0].result.netSuccesses;
 assert.deepEqual((await a.locator('[aria-label="Feststehende W10-Einzelergebnisse"] li').allInnerTexts()).map(Number),stored[0].roll.dice);
 await shot(a,'05-spieler-wurf-ergebnis');
 await regie.getByRole('list',{name:'Ausgegebene Proben'}).getByText('Wurf abgeschlossen').first().waitFor({timeout:20000});
 await regie.waitForFunction(n=>{const el=document.querySelector('[data-area-button=checks] [class*=areaBadge]');return (el?Number(el.textContent):0)===n;},owedBefore);
 await shot(regie,'06-regie-wurf-abgeschlossen');
 pass('one roll stored; Regie switches to "Wurf abgeschlossen" without reload');

 phase='closed views leave no open hints, also after reload';
 await a.getByRole('button',{name:'Würfelansicht nur für mich schließen'}).click();
 assert.equal(await a.locator('[class*=pendingRoll]').count(),0);assert.equal(await a.locator('[class*=ownHint]').count(),0,'no "Probe ausstehend" after rolling');
 await reenter(a);await a.waitForTimeout(2500);
 assert.equal(await a.getByRole('region',{name:'Gemeinsamer Würfelwurf'}).count(),0,'no old result pops up after reload');
 assert.equal(await a.locator('[class*=pendingRoll]').count(),0,'no "Neuer Wurf" hint after reload');
 assert.equal(await a.getByRole('status').filter({hasText:'Neue Charakterprobe'}).count(),0);
 await reenter(b);await b.waitForTimeout(1500);
 assert.equal(await b.locator('[class*=pendingRoll]').count(),0,'other player sees no stale hint');
 await shot(a,'07-spieler-nach-reload-ruhig');
 pass('no stale open hints after closing and reloading');

 phase='replay from the Würfelprotokoll never re-rolls';
 await a.getByRole('button',{name:'Würfel öffnen'}).click();
 const log=a.locator('[class*=diceLog]');await log.waitFor();assert.match(await a.getByRole('heading',{name:'Würfelprotokoll'}).innerText(),/Würfelprotokoll/);
 await shot(a,'08-wuerfelprotokoll');
 await log.getByRole('button',{name:/Schlüsselbund stehlen/}).first().click();
 await a.getByRole('region',{name:'Gemeinsamer Würfelwurf'}).waitFor();
 assert.deepEqual((await a.locator('[aria-label="Feststehende W10-Einzelergebnisse"] li').allInnerTexts()).map(Number),evidence.faces);
 assert.equal((await get(aC,q)).dice.events.length,rollsBefore+1,'replay adds no roll');
 await a.getByRole('button',{name:'Würfelansicht nur für mich schließen'}).click();
 pass('replay shows the stored faces '+evidence.faces.join(',')+' and adds no roll');

 phase='spontaneous check from the table Regie for the whole round; player B chooses freely';
 regie.close().catch(()=>{});
 await gm.getByRole('button',{name:'Regie (privat)'}).click();await gm.getByRole('tab',{name:/^Proben/}).click();
 const tableForm=gm.getByRole('region',{name:'Neue Probe'});await tableForm.getByLabel('Probe',{exact:true}).fill('Schloss der Wachstube');
 await tableForm.getByRole('button',{name:'Probe ausgeben'}).click();await tableForm.getByText('„Schloss der Wachstube“ ist ausgegeben.').waitFor({timeout:15000});
 await gm.getByRole('list',{name:'Ausgegebene Proben'}).getByText('0 von 2 gewürfelt').waitFor({timeout:15000});
 await b.locator('[class*=ownHint]').waitFor({timeout:20000});
 await b.locator('[class*=ownHint]').click();
 const bPanel=b.getByRole('region',{name:'Charakterprobe'});await bPanel.waitFor({timeout:15000});
 await bPanel.getByRole('button',{name:/^Geschick \d+$/}).click();await bPanel.getByRole('tab',{name:'Fähigkeiten'}).click();await bPanel.getByRole('button',{name:/^Handgemenge \d+$/}).click();
 assert.equal(await bPanel.getByRole('button',{name:/^Handgemenge \d+$/}).getAttribute('aria-pressed'),'true');
 await b.waitForFunction(()=>/\d+ W10/.test(document.querySelector('[aria-label="Aktive Charakterprobe"]')?.textContent||''));
 await shot(b,'09-spieler-b-freie-wahl');
 await bPanel.getByRole('button',{name:'Würfeln',exact:true}).click();await b.getByRole('region',{name:'Gemeinsamer Würfelwurf'}).waitFor({timeout:20000});
 await gm.getByRole('list',{name:'Ausgegebene Proben'}).getByText('1 von 2 gewürfelt').waitFor({timeout:20000});
 // While B's result is new for the SL, the SL table may show it; close it so the Regie stays readable.
 if(await gm.getByRole('button',{name:'Würfelansicht nur für mich schließen'}).count())await gm.getByRole('button',{name:'Würfelansicht nur für mich schließen'}).click();
 await gm.getByRole('list',{name:'Ausgegebene Proben'}).scrollIntoViewIfNeeded();
 await shot(gm,'10-tischregie-teilweise-gewuerfelt');
 pass('table Regie shows "1 von 2 gewürfelt" live after B rolled a freely chosen Geschick + Handgemenge');

 phase='mobile 390 × 844';
 const mobile=await context('command-a',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const m=await open(mobile,'A mobil');await m.locator('[class*=ownHint]').waitFor({timeout:20000});await m.locator('[class*=ownHint]').click();
 await m.getByRole('region',{name:'Charakterprobe'}).waitFor({timeout:15000});
 const overflow=await m.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=1,'no horizontal overflow: '+overflow);
 await shot(m,'11-mobil-probe-im-bogen');
 pass('mobile: own sheet with check opens, no horizontal overflow');

 phase='V20 block is explained, not rolled';
 const blockedId=crypto.randomUUID();
 assert.equal((await gmC.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'requestCheck',sessionId:active.sessionId,runId:active.runId,eventId:blockedId,title:'Dienstbuch durchsuchen',attributeId:'perception',abilityId:'investigation',difficulty:6,audience:{scope:'players',playerIds:['command-a']}}})).status(),200);
 await a.locator('[class*=ownHint]').waitFor({timeout:20000});await a.locator('[class*=ownHint]').click();
 const blockPanel=a.getByRole('region',{name:'Charakterprobe'});await blockPanel.waitFor();
 await blockPanel.locator('select').first().selectOption({label:'Dienstbuch durchsuchen · ausstehend'});
 await blockPanel.getByRole('button',{name:/^Wahrnehmung \d+, von der Spielleitung vorgegeben/}).click();await blockPanel.getByRole('tab',{name:'Fähigkeiten'}).click();await blockPanel.getByRole('button',{name:/^Nachforschungen \d+, von der Spielleitung vorgegeben/}).click();
 await blockPanel.getByRole('status').filter({hasText:'V20'}).waitFor({timeout:15000});assert.ok(await blockPanel.getByRole('button',{name:'Würfeln',exact:true}).isDisabled());
 await shot(a,'12-v20-sperre-kenntnis-ohne-wert');
 pass('knowledge without dots is blocked by the server with a readable V20 reason');
 phase='rights';
 const bStage=await get(bC,q);assert.ok(!bStage.dice.events.some(e=>e.checkRef?.requestId===check.id),'B cannot see A\'s targeted result');
 assert.ok(!JSON.stringify(bStage).includes('Schäfer bemerkt den Griff'),'GM hint of the prepared check stays private');
 pass('rights: B sees neither A\'s targeted roll nor the private SL hint');
 assert.deepEqual(errors,[]);
 writeFileSync(output+'/evidence.json',JSON.stringify(evidence,null,1));
 console.log('GE-01C BROWSER PASS',JSON.stringify(evidence));
}catch(e){console.error('FAIL in phase: '+phase);let n=0;for(const c of browser.contexts())for(const page of c.pages())await page.screenshot({path:output+'/fail-'+(n++)+'.jpg',type:'jpeg'}).catch(()=>{});console.error(errors.join('\n'));throw e;}
finally{await browser.close();}
