import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
// Use --locations-only for the location-trash regression.

const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8898';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.equal(new URL(base).port,'8898','Dedicated synthetic fixture only.');
const output='.local-work/open-issues';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});
const errors=[];
let phase='setup',activePage;
async function post(context,path,data){
  const response=await context.request.post(base+path,{headers:{Origin:base},data});
  assert.ok(response.ok(),path+' '+response.status()+' '+await response.text());
  return response.json();
}
async function get(context,path){
  const response=await context.request.get(base+path);
  assert.equal(response.status(),200,path);return response.json();
}
async function until(read,accept){
  const end=Date.now()+15000;
  while(Date.now()<end){const value=await read();if(accept(value))return value;await new Promise(resolve=>setTimeout(resolve,250));}
  throw Error('Expected stored state in '+phase);
}
try{
  for(const width of [1440,390]){
    phase=width+' setup';
    const context=await browser.newContext({viewport:{width,height:950}});
    await post(context,'/api/auth/login',{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'});
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(phase+': '+error.message));

    const alias=await context.request.get(base+'/sl/command-center?bereich=ortscms',{headers:{Host:'chronik-von-kleve.stenzel-maik.workers.dev'},maxRedirects:0});
    assert.equal(alias.status(),307,'Legacy page redirects');
    assert.equal(alias.headers().location,'https://chroniplay.cc/sl/command-center?bereich=ortscms');
    console.log('PASS '+width+' legacy hostname redirects and preserves the route');

    phase=width+' landing';
    await page.goto(base+'/kampagne');
    await page.getByRole('link',{name:'Zur ChroniPlay-Startseite',exact:true}).first().click();
    await page.locator('header[aria-label="Öffentliche Navigation"]').waitFor();
    assert.equal(new URL(page.url()).pathname,'/');
    console.log('PASS '+width+' signed-in account can return to the landing page');

    phase=width+' location controls';
    const root=await post(context,'/api/cms/locations',{level:'location',title:'SYNTHETIC deletion '+width+' '+randomUUID().slice(0,6)});
    const area=await post(context,'/api/cms/locations',{level:'area',title:'SYNTHETIC area '+width+' '+randomUUID().slice(0,6),parentId:root.id});
    const room=await post(context,'/api/cms/locations',{level:'room',title:'SYNTHETIC room '+width+' '+randomUUID().slice(0,6),parentId:area.id});
    await page.goto(base+'/sl/command-center?bereich=ortscms');
    await page.getByRole('combobox',{name:/^Hauptort/}).selectOption(root.id);
    const directory=page.getByRole('complementary',{name:'Ortsverzeichnis'});
    await directory.locator('[aria-current="page"]').filter({hasText:root.title}).waitFor();
    await directory.locator('summary').filter({hasText:/^Ortsverwaltung$/}).click();
    await directory.locator('summary').filter({hasText:/^Archiv, Papierkorb & Struktur/}).click();
    const remove=directory.getByRole('button',{name:'Ort löschen · Papierkorb',exact:true});
    await remove.scrollIntoViewIfNeeded();
    assert.ok(await remove.isVisible());
    const reachable=await remove.evaluate(button=>{
      const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      return button.contains(document.elementFromPoint(x,y));
    });
    assert.equal(reachable,true,'Delete control is reachable, not clipped by the directory.');
    await page.screenshot({path:output+'/directory-'+width+'.png',fullPage:true});
    page.once('dialog',dialog=>dialog.accept());
    await remove.click();
    await until(()=>get(context,'/api/cms/locations?place='+root.id+'&includeInactive=1'),value=>[root.id,area.id,room.id].every(id=>value.nodes.some(node=>node.id===id&&node.lifecycle==='deleted')));
    await until(()=>page.getByRole('combobox',{name:/^Hauptort/}).locator('option').evaluateAll(options=>options.map(option=>option.value)),ids=>!ids.includes(root.id));
    for(const item of [root,area,room])assert.equal(await directory.locator('nav[aria-label="Bereiche, Räume und Informationen"] button').filter({hasText:item.title}).count(),0,'Deleted entry is absent from the active tree');
    await page.reload();
    await until(()=>page.getByRole('combobox',{name:/^Hauptort/}).locator('option').evaluateAll(options=>options.map(option=>option.value)),ids=>ids.length>0&&!ids.includes(root.id));
    await page.screenshot({path:output+'/directory-after-delete-'+width+'.png',fullPage:true});
    await page.getByLabel('Papierkorb und Archiv anzeigen',{exact:true}).check();
    await page.getByRole('combobox',{name:/^Hauptort/}).selectOption(root.id);
    await directory.locator('[aria-current="page"]').filter({hasText:root.title}).waitFor();
    await directory.locator('summary').filter({hasText:/^Ortsverwaltung$/}).click();
    await directory.locator('summary').filter({hasText:/^Archiv, Papierkorb & Struktur/}).click();
    const restore=directory.getByRole('button',{name:'Teilbaum wiederherstellen',exact:true});
    await restore.waitFor();page.once('dialog',dialog=>dialog.accept());await restore.click();
    await until(()=>get(context,'/api/cms/locations?place='+root.id),value=>[root.id,area.id,room.id].every(id=>value.nodes.some(node=>node.id===id&&node.lifecycle==='active')));
    await page.getByLabel('Papierkorb und Archiv anzeigen',{exact:true}).uncheck();
    await page.getByRole('combobox',{name:/^Hauptort/}).selectOption(root.id);
    await page.getByRole('navigation',{name:'Bereiche, Räume und Informationen'}).locator('button[data-level="room"]').filter({hasText:room.title}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS '+width+' deleted location vanishes immediately and after reload; explicit trash and restoration include all rooms');
    if(process.argv.includes('--locations-only')){await context.close();continue;}

    phase=width+' prepared template';
    const catalog=await get(context,'/api/command-center');
    const scene=catalog.scenes.find(item=>item.title.startsWith('Szene 01'))||catalog.scenes[0];assert.ok(scene);
    await page.goto(base+'/sl/command-center?bereich=sitzung&scene='+scene.id+'&section=dialogueNotes');
    const figures=page.getByRole('group',{name:'Standardfiguren dieser Szene',exact:true});
    await figures.getByRole('button',{name:'Neue Vorlage aus Basisfigur',exact:true}).click();
    const name='SYNTHETIC custom guard '+width+' '+randomUUID().slice(0,6);
    await figures.getByLabel('Name der Vorlage',{exact:true}).fill(name);
    await figures.getByLabel('Attribut Geschick',{exact:true}).fill('4');
    await figures.getByText('Fähigkeiten bearbeiten',{exact:true}).click();
    await figures.getByLabel('Fähigkeit Handgemenge',{exact:true}).fill('5');
    await figures.getByLabel('Willenskraft',{exact:true}).fill('8');
    await figures.getByRole('button',{name:'Vorlage speichern',exact:true}).click();
    await figures.getByText('Vorlage gespeichert und ausgewählt.',{exact:true}).waitFor();
    const library=await get(context,'/api/figure-templates'),template=library.templates.find(item=>item.name===name);assert.ok(template);
    assert.equal(template.attributes.Geschick,4);assert.equal(template.skills.Handgemenge,5);
    await figures.getByRole('button',{name:'Hinzufügen',exact:true}).click();
    await until(()=>get(context,'/api/command-center/scenes?id='+scene.id),value=>value.scene.document.standardFigures.some(item=>item.templateId===template.id));
    await page.reload();
    await figures.locator('strong').filter({hasText:name}).waitFor();
    await page.screenshot({path:output+'/preparation-'+width+'.png',fullPage:true});
    console.log('PASS '+width+' own values saved in library and scene, retained after reload');

    phase=width+' Regie template';
    const active=await get(context,'/api/live-table?view=active');assert.ok(active.room?.started);
    await page.goto(base+'/sl/regie');
    await page.getByRole('navigation',{name:'Bereiche der Szene'}).getByRole('button',{name:'NPCs & Würfel',exact:true}).click();
    const librarySection=page.getByRole('region',{name:'Gespeicherte Gegnervorlagen'});
    await librarySection.getByLabel('Gespeicherte Gegnervorlage',{exact:true}).selectOption(template.id);
    const further=page.locator('summary').filter({hasText:/^Weitere Figur einsetzen$/});
    if(!await further.evaluate(summary=>summary.parentElement.open))await further.click();
    await further.locator('..').getByRole('button',{name:'Einsetzen',exact:true}).click();
    const live=await until(()=>get(context,'/api/live-figures?sessionId='+active.room.sessionId),value=>value.figures.some(item=>item.label===name+' 1'));
    const instance=live.figures.find(item=>item.label===name+' 1');
    assert.equal(instance.stats.actions.find(item=>item.label==='Zuschlagen').pool,9);
    await page.screenshot({path:output+'/regie-'+width+'.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS '+width+' Regie deploys saved enemy with pool 9 from its saved values');
    await context.close();
  }
  assert.deepEqual(errors,[],'No browser errors');
}catch(error){console.error('FAIL '+phase);if(activePage)await activePage.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
