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

// Clean up this run's deliveries so the fixture stays tidy.
for(const r of (await req('/api/live-deliveries?sessionId='+sessionId,gm)).data.runs)if(!r.withdrawnAt)await post(gm,{action:'withdraw',runId:r.id});
console.log(checks+' delivery checks passed.');
