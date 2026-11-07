import {randomUUID} from 'node:crypto';
import {resolveFigure} from '../domain/standard-figures.ts';
// Standard figures: GM only, per-figure state, no player payload, double-click safe, image links reuse the gallery.
export async function liveFiguresIntegration({req,check,base,testPassword,localSql}){
 localSql("DELETE FROM auth_rate_limits");
 const call=async(path,cookie,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});return {s:r.status,d:await r.json().catch(()=>({}))};};
 // Two ordinary invited players exist before the evening starts (real invitation flow, synthetic accounts).
 const tag=randomUUID().slice(0,6),players=[];
 for(const n of [1,2]){const email=`figures-${n}-${tag}@example.invalid`;const issued=await req('/api/alpha/access','gm','POST',{action:'invite',email,campaignId:'chronik-von-kleve',memberId:null,days:3});await call('/api/auth/invitations/accept',null,'POST',{token:issued.d.token,email,displayName:'Figures '+n,password:testPassword,confirmation:testPassword});const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,password:testPassword})});players.push(login.headers.get('set-cookie')?.split(';')[0]);}
 check(players.every(Boolean),'FIGURES two invited players are signed in');
 const sessionId=randomUUID(),url='/api/live-figures?sessionId='+sessionId;
 check((await req('/api/live-table','gm','POST',{action:'start',sessionId,title:'SYNTHETIC figures',create:true})).s===200,'FIGURES evening started');
 const empty=await req(url,'gm');
 check(empty.s===200&&Array.isArray(empty.d.figures)&&!empty.d.figures.length,'FIGURES GM starts with an empty list');
 // Players and anonymous users never reach the tool, its data or its commands.
 for(const [i,cookie] of players.entries()){
  const who=i+1;
  check([403,404].includes((await call(url,cookie)).s),'FIGURES player '+who+' cannot read figures');
  check([403,404].includes((await call('/api/live-figures',cookie,'POST',{action:'spawn',sessionId,requestId:randomUUID(),typeId:'security_bouncer',tierId:'standard',count:1})).s),'FIGURES player '+who+' cannot spawn');
 }
 check((await call(url)).s===401,'FIGURES anonymous denied');
 // Campaign-owned values are saved before an evening, and isolated from player requests.
 const templateUrl='/api/figure-templates',baseStats=resolveFigure('security_bouncer','standard');
 const template={id:randomUUID(),name:'FIGURES_PRIVATE_TEMPLATE',typeId:baseStats.typeId,tierId:baseStats.tierId,attributes:{...baseStats.attributes,Geschick:4},skills:{...baseStats.skills,Handgemenge:5},willpower:8,bloodMax:null};
 for(const cookie of players){
  check([403,404].includes((await call(templateUrl,cookie)).s),'TEMPLATES player cannot list values');
  check([403,404].includes((await call(templateUrl,cookie,'POST',{template,expectedVersion:0})).s),'TEMPLATES player cannot save values');
 }
 check((await call(templateUrl)).s===401,'TEMPLATES anonymous denied');
 const saved=await req(templateUrl,'gm','POST',{template,expectedVersion:0});
 check(saved.s===200&&saved.d.template.version===1,'TEMPLATES GM saves custom values');
 check((await req(templateUrl,'gm')).d.templates.some(item=>item.id===template.id&&item.willpower===8),'TEMPLATES library survives a fresh database read');
 const customSpawn={action:'spawn',sessionId,requestId:randomUUID(),typeId:template.typeId,tierId:template.tierId,count:1,templateId:template.id};
 const custom=await req('/api/live-figures','gm','POST',customSpawn);
 const instance=custom.d.figures.find(figure=>figure.label==='FIGURES_PRIVATE_TEMPLATE 1');
 check(custom.s===200&&instance?.stats.actions.find(action=>action.label==='Zuschlagen')?.pool===9,'TEMPLATES Regie uses saved attributes and abilities in its dice pools');
 const revised={...template,attributes:{...template.attributes,Geschick:3},willpower:6};
 check((await req(templateUrl,'gm','POST',{template:revised,expectedVersion:1})).s===200,'TEMPLATES own values can be revised');
 check((await req(templateUrl,'gm','POST',{template,expectedVersion:1})).s===409,'TEMPLATES stale edit cannot overwrite newer values');
 check((await req(url,'gm')).d.figures.find(item=>item.id===instance.id).stats.willpower===8,'TEMPLATES later changes leave existing live figures intact');
 check((await req('/api/live-figures','gm','POST',{...customSpawn,requestId:randomUUID(),typeId:'security_guard_basic'})).s===400,'TEMPLATES mismatched base type is rejected');
 check((await req('/api/live-figures','gm','POST',{...customSpawn,requestId:randomUUID(),templateId:randomUUID()})).s===404,'TEMPLATES missing template never silently falls back to default values');
 check((await req(templateUrl,'gm','POST',{template:{...revised,willpower:11},expectedVersion:2})).s===400,'TEMPLATES out-of-range values are rejected');
 await req('/api/live-figures','gm','POST',{action:'retire',sessionId,id:instance.id});
 // Spawn three separate instances; a repeated request id (double click) creates nothing new.
 const requestId=randomUUID(),spawn={action:'spawn',sessionId,requestId,typeId:'security_bouncer',tierId:'standard',count:3};
 const first=await req('/api/live-figures','gm','POST',spawn);
 check(first.s===200&&first.d.figures.length===3&&new Set(first.d.figures.map(f=>f.id)).size===3,'FIGURES three separate instances');
 check(first.d.figures.map(f=>f.label).join('|')==='Türsteher 1|Türsteher 2|Türsteher 3','FIGURES distinct numbered labels');
 check((await req('/api/live-figures','gm','POST',spawn)).d.figures.length===3,'FIGURES same request id does not duplicate');
 const [one,two,three]=first.d.figures;
 check(two.stats.actions.length>=3&&two.stats.actions.every(a=>a.pool>=1)&&two.stats.status==='entwurf','FIGURES statblock with dice pools, marked as draft');
 // State is per instance.
 const hurt=await req('/api/live-figures','gm','POST',{action:'update',sessionId,id:two.id,patch:{hurt:3,willpower:two.willpower-1,note:'SYNTHETIC note'}});
 const byId=Object.fromEntries(hurt.d.figures.map(f=>[f.id,f]));
 check(hurt.s===200&&byId[two.id].hurt===3&&byId[two.id].note==='SYNTHETIC note'&&byId[one.id].hurt===0&&byId[three.id].hurt===0,'FIGURES one injury leaves the others untouched');
 check((await req('/api/live-figures','gm','POST',{action:'update',sessionId,id:two.id,patch:{hurt:9}})).s===400,'FIGURES invalid health rejected');
 check((await req('/api/live-figures','gm','POST',{action:'update',sessionId,id:two.id,patch:{blood:3}})).s===400,'FIGURES no blood pool on a human');
 check((await req('/api/live-figures','gm','POST',{action:'spawn',sessionId,requestId:randomUUID(),typeId:'nope',tierId:'standard',count:1})).s===400,'FIGURES unknown type rejected');
 check((await req('/api/live-figures','gm','POST',{action:'spawn',sessionId,requestId:randomUUID(),typeId:'security_bouncer',tierId:'godlike',count:1})).s===400,'FIGURES unknown tier rejected');
 const vamp=await req('/api/live-figures','gm','POST',{action:'spawn',sessionId,requestId:randomUUID(),typeId:'supernatural_vampire_young',tierId:'hard',count:1});
 const v=vamp.d.figures.at(-1);
 check(v.stats.bloodMax>0&&(await req('/api/live-figures','gm','POST',{action:'update',sessionId,id:v.id,patch:{blood:v.stats.bloodMax-2}})).s===200,'FIGURES vampire blood pool is tracked');
 const rat=await req('/api/live-figures','gm','POST',{action:'spawn',sessionId,requestId:randomUUID(),typeId:'animal_rat',tierId:'extreme',count:1});
 check(rat.d.figures.at(-1).stats.encounter===true,'FIGURES extreme rat is flagged as an encounter, not a single super figure');
 // Image binding reuses a gallery file; no new upload path, unlinking never deletes the file.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),form=new FormData();
 form.set('file',new Blob([png],{type:'image/png'}),'SYNTHETIC_FIGURE.png');form.set('visibility','sl');
 const upload=await req('/api/files','gm','POST',form),fileId=upload.d.id;
 check(upload.s===200&&fileId,'FIGURES gallery image exists');
 const linked=await req('/api/live-figures','gm','POST',{action:'linkAsset',sessionId,typeId:'security_bouncer',tierId:null,fileId,label:'Schwarze Jacke',role:'fullbody'});
 check(linked.s===200&&linked.d.assets.some(x=>x.fileId===fileId&&x.typeId==='security_bouncer'),'FIGURES image linked to a figure type');
 check((await req('/api/live-figures','gm','POST',{action:'linkAsset',sessionId,typeId:'security_bouncer',tierId:null,fileId:'missing-file',label:'x',role:'fullbody'})).s===400,'FIGURES unknown file cannot be linked');
 const withImage=await req('/api/live-figures','gm','POST',{action:'update',sessionId,id:one.id,patch:{imageFileId:fileId}});
 check(withImage.s===200&&withImage.d.figures.find(f=>f.id===one.id).imageFileId===fileId&&withImage.d.figures.find(f=>f.id===three.id).imageFileId==='','FIGURES image is chosen per instance');
 const listing=await req(url,'gm');
 check(listing.s===200&&listing.d.assets.length===1,'FIGURES listing returns figures and image links');
 await req('/api/live-figures','gm','POST',{action:'unlinkAsset',sessionId,assetId:listing.d.assets[0].id});
 check(((await req('/api/files','gm')).d.files||[]).some(f=>f.id===fileId),'FIGURES unlinking keeps the gallery file');
 // Players never see a figure through the table or the stage snapshot.
 const playerStage=await call('/api/live-stage?sessionId='+sessionId,players[0]);
 check(playerStage.s===200,'FIGURES invited player reaches the stage');
 const stage=JSON.stringify(playerStage.d);
 check(!stage.includes('Türsteher')&&!stage.includes('SYNTHETIC note')&&!stage.includes('statblock')&&!stage.includes(fileId),'FIGURES no figure data in the player stage snapshot');

 // Table presentation: a figure with a picture goes on the stage like an NPC; without a picture it is refused; players see only the released object.
 const sid=id=>'standard-figure:'+sessionId+':'+id,stageUrl='/api/live-stage?sessionId='+sessionId;
 const gmStage=async()=>(await req(stageUrl,'gm')).d;
 const gmCommand=async command=>{const s=await gmStage();return req('/api/live-stage','gm','POST',{sessionId,runId:s.runId,expectedVersion:s.version,command});};
 check((await gmCommand({action:'add',kind:'npc',sourceId:sid(two.id),sourceKind:'record'})).s===400,'FIGURES a figure without a picture cannot go on the table');
 const addSl=await gmCommand({action:'add',kind:'npc',sourceId:sid(one.id),sourceKind:'record'});
 const placedObject=((await gmStage()).objects||[]).find(o=>o.sourceId===sid(one.id));
 check(addSl.s===200&&placedObject&&placedObject.kind==='npc'&&placedObject.visibility==='sl','FIGURES figure is placed on the table for the GM only ('+addSl.s+' '+JSON.stringify(addSl.d).slice(0,200)+' '+JSON.stringify(placedObject||null).slice(0,200)+')');
 const playerSees=async()=>((await call(stageUrl,players[0])).d.objects||[]).find(o=>o.sourceId===sid(one.id));
 check(!(await playerSees()),'FIGURES SL-only figure is invisible to players');
 const runState=await gmStage();
 check([403,404].includes((await call('/api/live-stage',players[0],'POST',{sessionId,runId:runState.runId,expectedVersion:runState.version,command:{action:'add',kind:'npc',sourceId:sid(three.id),sourceKind:'record'}})).s),'FIGURES a player cannot place a figure');
 const shown=await gmCommand({action:'visibility',id:placedObject.id,visible:true,recipients:null});
 const seen=await playerSees();
 check(shown.s===200&&seen&&seen.title==='Türsteher 1','FIGURES released figure appears for players with its name');
 const playerView=JSON.stringify(seen||{});
 check(!playerView.includes('"stats"')&&!playerView.includes('hurt')&&!playerView.includes('SYNTHETIC note'),'FIGURES players get no values or notes of the figure');
 // Retire only removes the chosen instance.
 const gone=await req('/api/live-figures','gm','POST',{action:'retire',sessionId,id:three.id});
 check(gone.s===200&&!gone.d.figures.some(f=>f.id===three.id)&&gone.d.figures.some(f=>f.id===one.id),'FIGURES retire removes only that instance');
 check((await req('/api/live-figures?sessionId='+randomUUID(),'gm')).s===404,'FIGURES unknown evening is not found');
}
