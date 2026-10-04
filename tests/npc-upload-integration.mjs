export async function npcUploadIntegration({req,check,base,ids}){
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=','base64');
  const form=()=>{const data=new FormData();data.set('file',new Blob([png],{type:'image/png'}),'synthetic-npc.png');data.set('visibility','sl');return data;};
  const image=async(id,who)=>fetch(base+'/api/files?id='+id,{headers:ids[who]??{}});
  check((await req('/api/files','a','POST',form())).s===403,'NPC upload: player cannot create SL image');
  const primary=await req('/api/files','gm','POST',form()),secondary=await req('/api/files','gm','POST',form());
  check(primary.s===200&&secondary.s===200,'NPC upload: SL stores both images in existing file service');
  const p=primary.d.id,s=secondary.d.id;
  check((await image(p,'a')).status===404,'NPC upload: unlinked image is secret');
  check((await image(p)).status===401,'NPC upload: anonymous image request denied');
  const gmImage=await image(p,'gm');
  check(gmImage.status===200&&Buffer.from(await gmImage.arrayBuffer()).equals(png),'NPC upload: SL reads original uploaded bytes');
  const payload={title:'SYNTHETIC UPLOAD TEST',canonStatus:'draft',playState:'unplayed',defaultVisibility:'sl_secret',profile:{image_primary:'/api/files?id='+p,image_secondary:'/api/files?id='+s,field_visibility:{name:'player_visible',image_primary:'player_visible'}},blocks:[],retainedRelationships:[],addedRelationships:[]};
  const created=await req('/api/entities/npc','gm','POST',payload);
  check(created.s===200,'NPC upload: images saved on original M1 NPC');
  const id=created.d.id;
  const save=async(profile,visibility)=>{const draft=(await req('/api/entities/npc?id='+id,'gm')).d;return req('/api/entities/npc','gm','POST',{...payload,id,revision:draft.revision,defaultVisibility:visibility,profile});};
  check((await image(p,'a')).status===404,'NPC upload: field release does not bypass secret NPC');
  check((await save(payload.profile,'player_visible')).s===200,'NPC upload: explicit NPC and primary field release saves');
  const playerImage=await image(p,'a');
  check(playerImage.status===200&&Buffer.from(await playerImage.arrayBuffer()).equals(png),'NPC upload: player reads only explicitly released image bytes');
  check((await image(s,'a')).status===404,'NPC upload: secret secondary image stays denied');
  check(!(await req('/api/files','a')).d.files.some(f=>f.id===p||f.id===s),'NPC upload: generic file list does not disclose NPC images');
  check((await req('/api/files','gm','DELETE',{id:p})).s===409,'NPC upload: referenced image cannot be deleted');
  const revoked={...payload.profile,field_visibility:{name:'player_visible',image_primary:'sl_secret'}};
  check((await save(revoked,'player_visible')).s===200&&(await image(p,'a')).status===404,'NPC upload: revoked field release immediately denies file URL');
  check((await save({image_primary:'',image_secondary:''},'sl_secret')).s===200,'NPC upload: removing image references preserves original NPC');
  for(const fileId of [p,s])check((await req('/api/files','gm','DELETE',{id:fileId})).s===200&&(await image(fileId,'gm')).status===404,'NPC upload: only unreferenced synthetic image is removed');
}
