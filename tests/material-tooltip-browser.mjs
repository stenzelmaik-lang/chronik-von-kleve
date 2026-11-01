import assert from 'node:assert/strict';
// The table tooltip of a material shows readable text, never the stored format (cvk-rich-v1 JSON or cvk-html-v1
// markup). Against scripts/start-material-3.ps1: the letter text is saved as cvk-rich-v1, laid out and hovered.
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.ok(['8893','8894'].includes(new URL(base).port),'Use the isolated synthetic material fixture only');
const browser=await chromium.launch({headless:true,channel:process.env.CVK_PLAYWRIGHT_CHANNEL||undefined});
try{
 const gm=await browser.newContext({viewport:{width:1440,height:900}});
 assert.equal((await gm.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'}})).status(),200);
 const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();const room={sessionId:active.room.sessionId,runId:active.room.runId};
 const q=base+'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId);
 const post=async(path,data)=>{const r=await gm.request.post(base+path,{headers:{Origin:base},data});assert.equal(r.status(),200,await r.text());return r.json();};
 const stage=async command=>{const cur=await (await gm.request.get(q)).json();return post('/api/live-stage',{...room,expectedVersion:cur.version,command});};
 const catalog=await (await gm.request.get(q+'&catalog=1')).json();const kaserne=catalog.scenes.find(s=>s.title.includes('Kaserne')).id;
 if(catalog.stageSceneId!==kaserne)await stage({action:'activateScene',sceneId:kaserne});
 // Store the letter text in the block format the editor writes today.
 const scene=(await (await gm.request.get(base+'/api/command-center/scenes?id='+encodeURIComponent(kaserne))).json()).scene;
 const rich='cvk-rich-v1:'+JSON.stringify({version:1,blocks:[{type:'heading2',children:[{text:'Die sechs Seiten'}]},{type:'paragraph',children:[{text:'Ein altes Schriftstück.'}]}]});
 const elements=scene.document.elements.map(e=>e.title==='Brief an Anselmus'?{...e,text:rich}:e);
 await post('/api/command-center/scenes',{action:'save',id:kaserne,version:scene.version,document:{...scene.document,elements}});
 const ctx=await (await gm.request.get(q+'&regie='+encodeURIComponent(kaserne))).json();
 const letter=ctx.materials.find(m=>m.title==='Brief an Anselmus');
 await stage({action:'add',kind:'document',sourceId:letter.id,sourceKind:'record',visible:true,recipients:null});
 const page=await gm.newPage();await page.goto(base+'/spielbereich?bereich=sitzung');
 const face=page.getByRole('button',{name:'Brief an Anselmus öffnen'});await face.waitFor();await face.hover();
 const tip=page.locator('[role=tooltip]',{hasText:'Brief an Anselmus'});await tip.waitFor();
 const text=await tip.innerText();
 assert.match(text,/Die sechs Seiten/);assert.match(text,/Ein altes Schriftstück/);
 assert.doesNotMatch(text,/cvk-|"type"|<\w/,'no stored format in the tooltip: '+text);
 console.log('PASS tooltip shows readable text: '+text.replace(/\s+/g,' '));
 const placed=(await (await gm.request.get(q)).json()).objects.find(o=>o.sourceId===letter.id);await stage({action:'remove',id:placed.id});
}finally{await browser.close();}
console.log('Material tooltip browser: all checks passed.');
