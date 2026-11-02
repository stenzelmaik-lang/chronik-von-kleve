import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE);
const {engineFixture}=await import('file:///C:/Users/Stenz/cvk-cp2-03b-check/tests/fixtures/engine-character.mjs');
const base='http://127.0.0.1:8820',pw='ChroniPlay-Demo-2036!',out=process.env.SHOTS;mkdirSync(out,{recursive:true});
const NOTE='CP2_03B_PRIVATE_PLAYER_NOTE',SLS='CP2_03B_SL_SESSION',CHAR='CP2-03B OWN SL CHARACTER';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const result=[];const rec=(step,ok,detail='')=>{result.push({step,ok,detail});console.log((ok?'OK   ':'FEHL ')+step+(detail?' · '+detail:''));};
const login=async(email)=>{const ctx=await browser.newContext({viewport:{width:1440,height:950},locale:'de-DE'});const r=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email,password:pw}});if(r.status()!==200)throw new Error('login '+email+' '+r.status());return ctx;};
const api=async(ctx,path,method='GET',data)=>{const r=await ctx.request.fetch(base+path,{method,headers:{Origin:base},...(data?{data}:{})});let body={};try{body=await r.json();}catch{}return {s:r.status(),d:body};};
const text=async(page)=>page.evaluate(()=>document.body.innerText);
const settle=async(page,wait)=>{await page.waitForLoadState('networkidle').catch(()=>{});if(wait)await page.getByText(wait).first().waitFor({timeout:15000}).catch(()=>{});await page.waitForTimeout(600);};
const step=async(name,fn)=>{try{await fn();}catch(e){rec(name,false,String(e.message).split('\n')[0]);}};
try{
 const gm=await login('command-gm@example.invalid'),pa=await login('command-a@example.invalid');
 // Seed synthetic data in the isolated fixture only (same markers as the CP2-03B integration test).
 const note=await api(pa,'/api/records','POST',{kind:'notizen',title:NOTE,visibility:'sl',body:{text:NOTE}});
 const sls=await api(gm,'/api/records','POST',{kind:'sitzungen',title:SLS,visibility:'sl',body:{summary:'CP2_03B_SL_ONLY'}});
 const ch=await api(gm,'/api/records','POST',{kind:'charaktere',title:CHAR,visibility:'private',body:{...engineFixture}});
 const sel=await api(gm,'/api/character-selection','PATCH',{characterId:ch.d.id});
 rec('Testdaten angelegt (Spielernotiz, SL-Sitzung, SL-eigener Charakter, Auswahl)',note.s===200&&sls.s===200&&ch.s===200&&sel.s===200,[note.s,sls.s,ch.s,sel.s].join('/'));
 const page=await gm.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // 1. SL im Spielerbereich
 await step('1 Spielerbereich (SL)',async()=>{
  await page.goto(base+'/spielbereich');await settle(page,'Spieler ·');await page.screenshot({path:out+'/1-sl-im-spielerbereich.png'});
  const t=await text(page);
  rec('1a Kopf "DEIN ORT IN DER NACHT", nicht "DIE CHRONIK IN DEINER HAND"',t.includes('DEIN ORT IN DER NACHT')&&!t.includes('DIE CHRONIK IN DEINER HAND'));
  rec('1b Fuß "Spieler ·", kein "Kampagne sichern"',/Spieler ·/.test(t)&&!t.includes('Kampagne sichern'));
  rec('1c keine SL-Inhalte/fremde Notiz sichtbar',!t.includes(SLS)&&!t.includes(NOTE)&&!t.includes('CP2_03B_SL_ONLY'));
  rec('1d Link "Command Center" in der Navigation',(await page.getByRole('link',{name:/Command Center/}).count())>0);
  const dash=await api(gm,'/api/dashboard');rec('1e eigener Charakter bleibt aktiv (API /api/dashboard)',dash.d.character?.id===ch.d.id,'Titel='+dash.d.character?.title);
  rec('1f eigener Charakter im Bildschirmtext',t.includes(CHAR));
 });
 // 2. Command Center
 await step('2 Command Center',async()=>{
  await page.getByRole('link',{name:/Command Center/}).first().click();await page.waitForURL(/\/sl\/command-center/);await settle(page,'COMMAND CENTER');
  const t=await text(page);await page.screenshot({path:out+'/2-command-center.png'});
  rec('2a URL /sl/command-center, Kopf "COMMAND CENTER · VORBEREITUNG"',/\/sl\/command-center/.test(page.url())&&t.includes('COMMAND CENTER · VORBEREITUNG'),page.url());
  rec('2b Kopf enthält "Kampagne sichern" und "Mein Spielerbereich"',t.includes('Kampagne sichern')&&t.includes('Mein Spielerbereich'));
  await page.getByRole('button',{name:'+ Spielabend anlegen',exact:true}).click();
  await page.getByRole('navigation',{name:'Spielabend planen Schritte',exact:true}).waitFor();
  rec('2c SL-Verwaltung: Spielabend anlegen öffnet die Planung',true);
  await page.screenshot({path:out+'/3-sl-verwaltung-spielabend-anlegen.png'});
 });
 await step('2 CMS mit SL-Inhalten',async()=>{
  await page.goto(base+'/sl/command-center?bereich=cms');await settle(page);
  const t=await text(page);await page.screenshot({path:out+'/4-chronik-cms-sl-inhalte.png'});
  rec('2d Chronik-CMS zeigt SL-Inhalt (SL-Sitzung) und listet Spielernotiz-Bereiche',t.includes(SLS),'SL-Sitzung sichtbar='+t.includes(SLS)+' · Notiz sichtbar='+t.includes(NOTE));
 });
 // 3. zurück
 await step('3 Zurück zum Spielerbereich',async()=>{
  await page.goto(base+'/sl/command-center');await settle(page,'COMMAND CENTER');
  await page.getByRole('link',{name:/Mein Spielerbereich/}).click();await page.waitForURL(/\/spielbereich(\?|$)/);await settle(page,'Spieler ·');
  const t=await text(page);await page.screenshot({path:out+'/5-zurueck-im-spielerbereich.png'});
  rec('3a URL /spielbereich nach Klick auf "Mein Spielerbereich"',/\/spielbereich/.test(page.url()),page.url());
  rec('3b keine übernommenen SL-Inhalte, Spieler-Kopf/-Fuß',!t.includes(SLS)&&!t.includes(NOTE)&&!t.includes('CP2_03B_SL_ONLY')&&t.includes('DEIN ORT IN DER NACHT')&&!t.includes('Kampagne sichern')&&!t.includes('COMMAND CENTER'));
  const dash=await api(gm,'/api/dashboard');rec('3c eigene Charakterauswahl unverändert',dash.d.character?.id===ch.d.id&&t.includes(CHAR),'Titel='+dash.d.character?.title);
  const recs=await api(gm,'/api/records?kind=sitzungen');rec('3d API Spielerbereich liefert keine SL-Sitzung',!JSON.stringify(recs.d).includes(SLS));
  const recsSl=await api(gm,'/api/records?kind=sitzungen&view=sl');rec('3e API view=sl liefert SL-Sitzung weiterhin',JSON.stringify(recsSl.d).includes(SLS));
 });
 if(errors.length)rec('Seitenfehler im Browser',false,errors.slice(0,3).join(' | '));else rec('keine Seitenfehler (SL-Seite)',true);
 // 4. normaler Spieler
 await step('4 Normaler Spielerzugang',async()=>{
  const p=await pa.newPage();p.setDefaultTimeout(15000);await p.goto(base+'/spielbereich');await settle(p,'Spieler ·');
  const t=await text(p);await p.screenshot({path:out+'/6-spieler-a-spielerbereich.png'});
  rec('4a Spieler: Spielerbereich lädt mit "Spieler ·", ohne Command-Center-Link',/Spieler ·/.test(t)&&(await p.getByRole('link',{name:/Command Center/}).count())===0&&!t.includes(SLS));
  const resp=await p.goto(base+'/sl/command-center');await settle(p);const t2=await text(p);await p.screenshot({path:out+'/7-spieler-command-center-verwehrt.png'});
  rec('4b Spieler: /sl/command-center verwehrt (kein SL-Inhalt, kein Verwaltungskopf)',!t2.includes('COMMAND CENTER · VORBEREITUNG')&&!t2.includes(SLS),'URL='+p.url()+' · Status='+resp?.status());
  rec('4c Spieler: view=sl verwehrt',(await api(pa,'/api/records?kind=notizen&view=sl')).s===403);
  const own=await api(pa,'/api/records?kind=notizen');rec('4d Spieler: eigener Zugriff funktioniert (API 200)',own.s===200);
 });
}catch(e){rec('Abbruch',false,String(e.stack||e).split('\n').slice(0,3).join(' | '));}
writeFileSync(out+'/ergebnis.json',JSON.stringify(result,null,1));
await browser.close();
