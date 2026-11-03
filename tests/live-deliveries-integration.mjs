import assert from 'node:assert/strict';
// Visions & personal messages (Alpha 2.0) against the isolated --regie fixture: three separate synthetic accounts.
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8870';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Synthetic local instances only');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS DELIVERY '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
async function req(path,cookie,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});const type=r.headers.get('content-type')||'';return {status:r.status,data:type.includes('json')?await r.json():null,type};}
const room=(await req('/api/live-table?view=active',gm)).data.room,{sessionId}=room;
const stage=async who=>(await req('/api/live-stage?sessionId='+encodeURIComponent(sessionId),who)).data;
const catalog=(await req('/api/live-stage?sessionId='+encodeURIComponent(sessionId)+'&catalog=1',gm)).data,sceneId=catalog.scenes[0].id;
const images=catalog.catalog.filter(f=>f.sourceKind==='file'&&f.mime?.startsWith('image/')).slice(0,2).map(f=>f.id);
let scene=(await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene;
const save=async(document,expected=200)=>{const r=await req('/api/command-center/scenes',gm,{action:'save',id:sceneId,version:scene.version,document});assert.equal(r.status,expected,JSON.stringify(r.data));if(expected===200)scene=r.data.scene;return r;};
const uuid=()=>crypto.randomUUID();
const dark={id:uuid(),kind:'vision',title:'INTERNAL_DARK_TITLE',text:'cvk-html-v1:<p>Absatz eins</p><p>SECRET_A_VISION</p>',recipientIds:['command-a'],fileIds:images,preset:'dark',fragments:['Der Raum atmet.','SECRET_A_VISION'],note:'NOTE_ONLY_GM'};
const dream={id:uuid(),kind:'vision',title:'Traum nur B',text:'SECRET_B_VISION',recipientIds:['command-b'],fileIds:[],preset:'dream'};
const group={id:uuid(),kind:'vision',title:'Gruppenvision',text:'GROUP_VISION_TEXT',recipientIds:[],fileIds:[],preset:'drama'};
const fax={id:uuid(),kind:'letter',title:'INTERNAL_FAX_TITLE',text:'cvk-html-v1:<p>SECRET_A_FAX</p>',recipientIds:['command-a'],fileIds:[],layout:'fax',sender:'Kanzlei Vogt'};
await save({...scene.document,whispers:[dark,dream,group,fax]});
check(scene.document.whispers.find(w=>w.id===dark.id).preset==='dark','scene keeps preset, sections and note of a prepared vision');
check((await save({...scene.document,whispers:[{...dark,preset:'godlike'}]},400)).status===400,'unknown preset is rejected on save');
const post=(who,body)=>req('/api/live-deliveries',who,{sessionId,...body});
const deliver=(who,w,recipients,requestId=uuid(),sceneVersion=scene.version)=>post(who,{action:'deliver',requestId,sceneId,whisperId:w.id,sceneVersion,recipients});

// Only the GM triggers; players cannot list or trigger.
check((await deliver(a,dark,{mode:'prepared'})).status===403&&(await req('/api/live-deliveries?sessionId='+sessionId,a)).status===403,'players cannot trigger or list deliveries');
check((await req('/api/live-deliveries?sessionId='+sessionId)).status===401,'anonymous denied');
check((await deliver(gm,dark,{mode:'prepared'},uuid(),scene.version-1)).status===409,'stale preparation is refused');
check((await deliver(gm,group,{mode:'prepared'})).status===400,'an entry without prepared recipients needs an explicit choice');
check((await deliver(gm,dark,{mode:'players',playerIds:['no-such-player']})).status===400,'a recipient outside the round is refused');

// Single recipient, double click safe.
const once=uuid(),first=await deliver(gm,dark,{mode:'prepared'},once),again=await deliver(gm,dark,{mode:'prepared'},once);
check(first.status===200&&again.data.runs.length===first.data.runs.length,'the same request id never delivers twice');
const darkRun=first.data.runs.at(-1);
const aStage=await stage(a),bStage=await stage(b);
const mine=(aStage.deliveries||[]).find(d=>d.id===darkRun.id);
check(mine&&mine.preset==='dark'&&mine.fragments.join('|')==='Der Raum atmet.|SECRET_A_VISION'&&mine.images.length===images.length,'player A receives the vision with its look, sections and pictures');
const aText=JSON.stringify(aStage.deliveries);
check(!aText.includes('INTERNAL_DARK_TITLE')&&!aText.includes('NOTE_ONLY_GM')&&!aText.includes('command-b')&&!aText.includes('"recipients"'),'no internal title, note or other recipients for the player');
check(!JSON.stringify(bStage).includes('SECRET_A_VISION')&&!(bStage.deliveries||[]).length,'player B receives nothing of A\'s vision');
const asset=(who,run,fileId)=>req('/api/live-deliveries/asset?sessionId='+encodeURIComponent(sessionId)+'&runId='+run+'&fileId='+encodeURIComponent(fileId),who);
check((await asset(a,darkRun.id,images[0])).status===200,'recipient opens a picture of the own vision');
check([403,404].includes((await asset(b,darkRun.id,images[0])).status)&&(await asset(undefined,darkRun.id,images[0])).status===401,'other players and anonymous users cannot open it');
const foreign=catalog.catalog.find(f=>f.sourceKind==='file'&&f.mime?.startsWith('image/')&&!images.includes(f.id));
if(foreign)check((await asset(a,darkRun.id,foreign.id)).status===404,'a file outside the delivery cannot be fetched through it');

// Two players, two different visions at the same time.
const dreamRun=(await deliver(gm,dream,{mode:'prepared'})).data.runs.at(-1);
const a2=await stage(a),b2=await stage(b);
check((a2.deliveries||[]).every(d=>d.id!==dreamRun.id)&&(b2.deliveries||[]).some(d=>d.id===dreamRun.id&&d.preset==='dream')&&!JSON.stringify(b2.deliveries).includes('SECRET_A_VISION'),'two players get two different visions, each only their own');

// Seen and acknowledged per recipient; reload keeps an unconfirmed vision.
check((await post(b,{action:'ack',runId:darkRun.id})).status===404,'a non-recipient cannot confirm someone else\'s vision');
check((await post(a,{action:'seen',runId:darkRun.id})).status===200,'recipient reports the vision as seen');
let list=(await req('/api/live-deliveries?sessionId='+sessionId,gm)).data.runs;
check(list.find(r=>r.id===darkRun.id).receipts['command-a']?.seenAt&&!list.find(r=>r.id===darkRun.id).receipts['command-a']?.ackAt,'GM sees "running" for A');
check((await stage(a)).deliveries.some(d=>d.id===darkRun.id&&d.seen),'after a reload the unconfirmed vision is still there');
check((await post(a,{action:'ack',runId:darkRun.id})).status===200&&(await post(a,{action:'ack',runId:darkRun.id})).status===200,'confirming twice is harmless');
check(!(await stage(a)).deliveries.some(d=>d.id===darkRun.id),'after confirmation the vision is gone for A');
check([403,404].includes((await asset(a,darkRun.id,images[0])).status),'after confirmation its pictures are closed again');

// Whole group, independent confirmations.
const groupRun=(await deliver(gm,group,{mode:'all'})).data.runs.at(-1);
check(groupRun.recipients.includes('command-a')&&groupRun.recipients.includes('command-b')&&!groupRun.recipients.includes('command-gm'),'whole group means every player at the table, not the GM');
await post(a,{action:'ack',runId:groupRun.id});
check(!(await stage(a)).deliveries.some(d=>d.id===groupRun.id)&&(await stage(b)).deliveries.some(d=>d.id===groupRun.id),'group members confirm independently');

// Withdraw and resend to a single player; preparation stays.
check((await post(a,{action:'withdraw',runId:dreamRun.id})).status===403,'a player cannot withdraw');
await post(gm,{action:'withdraw',runId:dreamRun.id});
check(!(await stage(b)).deliveries.some(d=>d.id===dreamRun.id),'a withdrawn vision disappears for the recipient');
const again2=await deliver(gm,dark,{mode:'players',playerIds:['command-a']});
check(again2.status===200&&(await stage(a)).deliveries.some(d=>d.id===again2.data.runs.at(-1).id),'the same prepared vision can be sent again to one player');
check((await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene.document.whispers.length===4,'triggering never consumes the preparation');

// Personal message as a fax.
const faxRun=(await deliver(gm,fax,{mode:'prepared'})).data.runs.at(-1);
const faxView=(await stage(a)).deliveries.find(d=>d.id===faxRun.id);
check(faxView&&faxView.kind==='letter'&&faxView.layout==='fax'&&faxView.sender==='Kanzlei Vogt'&&faxView.html.includes('SECRET_A_FAX')&&!JSON.stringify(faxView).includes('INTERNAL_FAX_TITLE'),'the fax reaches A with sender and text, without the internal title');
check(!JSON.stringify(await stage(b)).includes('SECRET_A_FAX'),'B never receives A\'s message');

// Tempo of a vision and arrival sound of a message travel with the run.
const brisk={id:uuid(),kind:'vision',title:'Zügig',text:'TEMPO_TEXT',recipientIds:['command-a'],fileIds:[],preset:'classic',tempo:'brisk'};
const letterQuiet={id:uuid(),kind:'letter',title:'Brief leise',text:'QUIET_LETTER',recipientIds:['command-a'],fileIds:[],layout:'letter',sound:'none'};
const letterLoud={id:uuid(),kind:'letter',title:'Brief laut',text:'LOUD_LETTER',recipientIds:['command-a'],fileIds:[],layout:'letter'};
await save({...scene.document,whispers:[...scene.document.whispers,brisk,letterQuiet,letterLoud]});
const ids=[];for(const w of [brisk,letterQuiet,letterLoud,fax])ids.push((await deliver(gm,w,{mode:'prepared'})).data.runs.at(-1).id);
const byId=Object.fromEntries((await stage(a)).deliveries.map(d=>[d.id,d]));
check(byId[ids[0]]?.tempo==='brisk'&&byId[ids[1]]?.arrivalSound===null&&byId[ids[2]]?.arrivalSound==='letter'&&byId[ids[3]]?.arrivalSound==='fax','tempo and arrival sound (fax, letter, off) reach the player');

// Own gallery sections for visions and messages: GM only, pictures and sounds only, always SL-internal.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const wav=(()=>{const b=Buffer.alloc(444);b.write('RIFF',0);b.writeUInt32LE(436,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(400,40);return b;})();
const upload=async(who,bytes,type,name,section,visibility='sl')=>{const form=new FormData();form.set('file',new Blob([bytes],{type}),name);form.set('visibility',visibility);if(section)form.set('section',section);const r=await fetch(base+'/api/files',{method:'POST',headers:{Cookie:who,Origin:base},body:form});return {status:r.status,data:await r.json().catch(()=>null)};};
const visionPic=await upload(gm,png,'image/png','SYNTH-vision.png','visionen'),messageSound=await upload(gm,wav,'audio/wav','SYNTH-fax.wav','botschaften');
const listed=(await req('/api/files',gm)).data.files;
check(visionPic.status===200&&visionPic.data.section==='visionen'&&listed.find(f=>f.id===visionPic.data.id)?.section==='visionen'&&listed.find(f=>f.id===visionPic.data.id)?.visibility==='sl'&&listed.find(f=>f.id===messageSound.data.id)?.section==='botschaften','uploads land in their own section and stay SL-internal');
check(images.length>0&&images.every(id=>listed.find(f=>f.id===id)?.section===null),'the general gallery keeps its files without a section');
check((await upload(a,png,'image/png','SYNTH-player.png','visionen','group')).status===403,'players cannot upload into the vision section');
check((await upload(gm,png,'image/png','SYNTH-x.png','geheim')).status===400&&(await upload(gm,Buffer.from('%PDF-1.4\n%%EOF'),'application/pdf','SYNTH.pdf','botschaften')).status===400,'unknown sections and other file types are refused');
check(!(await req('/api/files',a)).data.files.some(f=>f.id===visionPic.data.id),'players never see the vision section in their gallery');
const withPic={...brisk,id:uuid(),title:'Mit eigenem Bild',fileIds:[visionPic.data.id],audioFileId:undefined};
const withSound={...letterLoud,id:uuid(),title:'Mit eigenem Ton',audioFileId:messageSound.data.id};
await save({...scene.document,whispers:[...scene.document.whispers,withPic,withSound]});
const picRun=(await deliver(gm,withPic,{mode:'prepared'})).data.runs.at(-1),soundRun=(await deliver(gm,withSound,{mode:'prepared'})).data.runs.at(-1);
const soundView=(await stage(a)).deliveries.find(d=>d.id===soundRun.id);
check((await asset(a,picRun.id,visionPic.data.id)).status===200&&soundView?.audio===true&&soundView.arrivalSound===null&&(await asset(a,soundRun.id,messageSound.data.id)).status===200,'section media reach the recipient through the delivery; an own sound replaces the built-in one');
check([403,404].includes((await asset(b,picRun.id,visionPic.data.id)).status),'other players still cannot open section media');

// Spontaneous from the Regie: delivered right away, kept in the scene only on request, never twice for one request.
const whisperCount=async()=>(await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene.document.whispers.length;
const compose=(who,entry,recipients,save=false,requestId=uuid())=>post(who,{action:'compose',requestId,sceneId,entry,recipients,save});
const countBefore=await whisperCount();
const quick={id:uuid(),kind:'letter',title:'SPONTAN_INTERN',text:'SPONTAN_FAX_FUER_B',recipientIds:[],fileIds:[],layout:'fax',sender:'Unbekannt'};
check((await compose(a,quick,{mode:'all'})).status===403&&(await post(a,{action:'save-entry',sceneId,entry:quick})).status===403,'players cannot compose or save entries');
check((await compose(gm,{...quick,preset:'godlike'},{mode:'all'})).status===400&&(await compose(gm,quick,{mode:'players',playerIds:['no-such-player']})).status===400,'invalid spontaneous content or recipients are refused');
const once2=uuid(),q1=await compose(gm,quick,{mode:'players',playerIds:['command-b']},false,once2),q2=await compose(gm,quick,{mode:'players',playerIds:['command-b']},false,once2);
const quickRun=q1.data.runs.at(-1);
check(q1.status===200&&q2.data.runs.length===q1.data.runs.length&&quickRun.whisperId===quick.id&&!q1.data.scene,'a spontaneous fax goes out once, even on a double click, without touching the scene');
const quickView=(await stage(b)).deliveries.find(d=>d.id===quickRun.id);
check(quickView&&quickView.layout==='fax'&&quickView.html.includes('SPONTAN_FAX_FUER_B')&&!JSON.stringify(quickView).includes('SPONTAN_INTERN')&&!JSON.stringify(await stage(a)).includes('SPONTAN_FAX_FUER_B'),'only the chosen player gets it, without the internal title');
check(await whisperCount()===countBefore,'an unsaved spontaneous entry is not kept in the scene');
const keep={id:uuid(),kind:'vision',title:'Spontan gespeichert',text:'Absatz eins\n\nAbsatz zwei',recipientIds:[],fileIds:[],preset:'drama',tempo:'brisk'};
const k1=uuid(),kept=await compose(gm,keep,{mode:'all'},true,k1),keptAgain=await compose(gm,keep,{mode:'all'},true,k1);
const keptRun=kept.data.runs.at(-1);
check(kept.status===200&&kept.data.scene?.whispers.some(w=>w.id===keep.id)&&keptAgain.data.runs.length===kept.data.runs.length&&await whisperCount()===countBefore+1,'"save" keeps the entry in the scene exactly once and delivers it once');
check(keptRun.recipients.includes('command-a')&&keptRun.recipients.includes('command-b')&&(await stage(a)).deliveries.some(d=>d.id===keptRun.id&&d.fragments.length===2&&d.tempo==='brisk'),'the whole group gets the spontaneous vision with its paragraphs and tempo');
const edited=await post(gm,{action:'save-entry',sceneId,entry:{...keep,title:'Umbenannt in der Regie',preset:'echo'}});
const after=(await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene;
check(edited.status===200&&edited.data.scene.version===after.version&&after.document.whispers.filter(w=>w.id===keep.id).length===1&&after.document.whispers.find(w=>w.id===keep.id).preset==='echo'&&await whisperCount()===countBefore+1,'editing in the Regie replaces the entry and returns the new scene version');
check((await deliver(gm,{...keep},{mode:'all'},uuid(),after.version)).status===200,'the edited entry can be triggered with the version the Regie got back');

// Clean up this run's deliveries so the fixture stays tidy.
for(const r of (await req('/api/live-deliveries?sessionId='+sessionId,gm)).data.runs)if(!r.withdrawnAt)await post(gm,{action:'withdraw',runId:r.id});
console.log(checks+' delivery checks passed.');
