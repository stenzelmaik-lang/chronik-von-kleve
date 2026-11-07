import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {emptyScene} from '../domain/story-scene.ts';
import {emptyStory} from '../domain/command-workspace.ts';
import {richTextToPlainText,htmlToRichText} from '../domain/location-rich-text.ts';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8901';assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):8901$/);
const output='.local-work/text20k';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined}),checks=[],errors=[],timings=[];let phase='setup',page;
const pass=name=>{checks.push(name);console.log('PASS '+name);};
async function account(id){const c=await browser.newContext({viewport:{width:1440,height:950}});const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});assert.equal(r.status(),200);return c;}
async function request(ctx,path,data,status=200){const start=performance.now(),r=await ctx.request.fetch(base+path,{method:data?'POST':'GET',headers:{Origin:base},...(data?{data}:{})});timings.push({path,method:data?'POST':'GET',ms:Math.round(performance.now()-start),bytes:data?Buffer.byteLength(JSON.stringify(data)):0});const body=await r.json();assert.equal(r.status(),status,path+' '+JSON.stringify(body).slice(0,180));return body;}
try{
 const gm=await account('command-gm'),player=await account('command-a');
 const active=await request(gm,'/api/live-table?view=active');assert.ok(active.room?.title.startsWith('SYNTHETISCH'),'Only synthetic fixture');
 const full='SYNTHETIC_PRIVATE_BEGIN '+ 'x'.repeat(19952)+' SYNTHETIC_PRIVATE_END__';assert.equal(full.length,20000);
 phase='persist scene';const document=emptyScene();document.title='SYNTHETISCH 20k '+randomUUID().slice(0,8);for(const key of ['narration','atmosphere','gmNotes','dialogueNotes','interactions','secrets','visions','possibleConsequences'])document[key]=full;
 document.elements=[{id:randomUUID(),kind:'dialogue',title:'SYNTHETISCH langer Dialog',text:full,referenceId:'',fileId:''}];
 const scene=(await request(gm,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document},201)).scene;
 const stored=(await request(gm,'/api/command-center/scenes?id='+scene.id)).scene;for(const key of ['narration','atmosphere','gmNotes','dialogueNotes','interactions','secrets','visions','possibleConsequences'])assert.equal(richTextToPlainText(stored.document[key]),full);assert.equal(richTextToPlainText(stored.document.elements[0].text),full);
 await request(gm,'/api/command-center/scenes',{action:'save',id:scene.id,version:scene.version,document:{...scene.document,dialogueNotes:full+'X'}},400);
 assert.equal((await request(gm,'/api/command-center/scenes?id='+scene.id)).scene.version,scene.version);
 pass('Szenen mit neun vollständigen 20.000-Zeichen-Texten speichern und laden; 20.001 wird ohne Überschreiben abgewiesen');
 phase='story and session';const story=emptyStory();story.title='SYNTHETISCH 20k Story';for(const key of Object.keys(story.sections))story.sections[key]=full;
 const savedStory=(await request(gm,'/api/command-center/story',{action:'create',clientRequestId:randomUUID(),document:story},201)).story;const reloadedStory=(await request(gm,'/api/command-center/story?id='+savedStory.id)).story;for(const value of Object.values(reloadedStory.sections))assert.equal(richTextToPlainText(value),full);
 const session=(await request(gm,'/api/command-center/preparation',{action:'create',clientRequestId:randomUUID(),document:{title:'SYNTHETISCH 20k Abend',notes:full}},201)).session;assert.equal(richTextToPlainText((await request(gm,'/api/command-center/preparation?id='+session.id)).session.document.notes),full);
 pass('Alle Storyabschnitte und Spielabendnotizen behalten 20.000 Zeichen einschließlich Textende');
 phase='NPC and material';const npc=await request(gm,'/api/entities/npc',{title:'SYNTHETISCH 20k NPC',canonStatus:'draft',playState:null,defaultVisibility:'sl_secret',profile:{},blocks:[...Array.from({length:4},(_,position)=>({kind:'bio',content:full,visibility:'sl_secret',position})),{kind:'legacy',content:'L'.repeat(90000),visibility:'sl_secret',position:4}],retainedRelationships:[],addedRelationships:[]});
 const npcRead=await request(gm,'/api/entities/npc?id='+npc.id);assert.equal(npcRead.blocks.length,5);assert.equal(npcRead.blocks.filter(b=>b.content===full).length,4);assert.ok(npcRead.blocks.some(b=>b.content==='L'.repeat(90000)));
 await request(player,'/api/entities/npc?id='+npc.id,undefined,403);await request(player,'/api/content-blocks?entityId='+npc.id,undefined,404);
 const material=(await request(gm,'/api/table-materials',{material:{title:'SYNTHETISCH 20k Handout',kind:'document',text:htmlToRichText('<p>'+'&amp;'.repeat(20000)+'</p>'),fileId:'',pages:[]}})).material;assert.equal(richTextToPlainText(material.text),'&'.repeat(20000));
 pass('NPC-Blöcke mit 20.000 sowie bestehender 90.000-Grenze; HTML-Handout ohne Verlust, SL-Inhalte vor Spielern geschützt');
 phase='bounded request size';await request(gm,'/api/command-center/scenes',{padding:'x'.repeat(500001)},413);await request(player,'/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document},403);await request(gm,'/api/table-materials',{padding:'x'.repeat(150001)},413);
 pass('Größere Gesamtpakete nur für berechtigte SL-Vorbereitung; allgemeine Anfragengrenze und Überschreitungsprüfung bleiben wirksam');
 phase='editor';page=await gm.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(base+'/sl/command-center?bereich=sitzung&scene='+scene.id+'&section=dialogueNotes');
 await page.getByText('20000/20000',{exact:true}).waitFor();await page.getByRole('button',{name:'HTML-Quelltext',exact:true}).last().click();const html=page.getByRole('textbox',{name:/ HTML$/}).last();
 const edited='EDITOR_BEGIN '+ 'Y'.repeat(19976)+' EDITOR_END';assert.equal(edited.length,20000);await html.fill('<p>'+edited+'</p>');await page.getByRole('button',{name:'Jetzt speichern',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('span,p')].some(n=>/^Gespeichert ·/.test(n.textContent||'')));
 assert.equal(richTextToPlainText((await request(gm,'/api/command-center/scenes?id='+scene.id)).scene.document.dialogueNotes),edited);
 await page.screenshot({path:output+'/editor-20000.png',fullPage:true});await html.fill('<p>'+edited+'X</p>');await page.getByText('20001/20000',{exact:true}).waitFor();await page.getByRole('button',{name:'Jetzt speichern',exact:true}).click();
 assert.equal(await html.inputValue(),'<p>'+edited+'X</p>');assert.equal(richTextToPlainText((await request(gm,'/api/command-center/scenes?id='+scene.id)).scene.document.dialogueNotes),edited);
 pass('Echter HTML-Editor zeigt 20.000, speichert vollständig und erhält einen ungültigen 20.001-Zeichen-Entwurf ohne Datenverlust');
 assert.deepEqual(errors,[]);writeFileSync(output+'/result.json',JSON.stringify({checks,errors,timings},null,2));console.log('ALL PASS: '+checks.length+' authoring-limit workflows');
}catch(e){console.error('FAILED PHASE '+phase);if(page)await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
