import {loadNPCList,loadNPCDetail,loadEntityDossier} from '../app/spielbereich/modules/npc-data.ts';
import {dossierSections,dossierRelations} from '../app/spielbereich/modules/npc-dossier-data.ts';
export async function m1Integration({req,check,localSql}) {
  const path='/api/entities';
  const make=async(type,title,defaultVisibility='player_visible')=>{
    const r=await req(path,'gm','POST',{type,title,text:'M1_VISIBLE',canonStatus:'confirmed',playState:'unplayed',defaultVisibility,gmBody:'M1_SECRET'});
    check(r.s===201,'M1 creates '+type); return r.d.id;
  };
  const npc=await make('NPC','M1 NPC'),place=await make('PLACE','M1 PLACE'),scene=await make('SCENE','M1 SCENE'),story=await make('storyline','M1 STORY'),session=await make('SESSION','M1 SESSION');
  check((await req(path+'?id='+scene,'a')).s===200,'M1 visible entity requires no extra legacy grant');
  const patch=async(id,expectedVersion,data)=>req(path,'gm','PATCH',{id,expectedVersion,...data});
  check((await patch(scene,1,{playState:'played'})).s===200,'M1 transitions unplayed to played');
  check((await patch(scene,1,{playState:'historical'})).s===409,'M1 rejects stale metadata update');
  check((await patch(scene,2,{replacedBy:scene})).s===400,'M1 rejects self replacement');
  check((await patch(scene,2,{replacedBy:'missing'})).s===400,'M1 rejects absent replacement');
  localSql("INSERT INTO entities(id,campaign_id,type,owner_id,created_at,updated_at) VALUES('m1-foreign','phase-b-other-campaign','NPC','other','test','test')");
  check((await patch(scene,2,{replacedBy:'m1-foreign'})).s===400,'M1 rejects cross-campaign replacement');
  check((await patch(scene,2,{canonStatus:'replaced',replacedBy:story})).s===200,'M1 marks existing entity replaced and links successor');
  const saved=(await req(path+'?id='+scene,'gm')).d.entities[0];
  check(saved.canonStatus==='replaced'&&saved.playState==='played'&&saved.replacedBy===story,'M1 metadata survives reread with stable identity');
  check((await req(path,'a','PATCH',{id:scene,expectedVersion:3,playState:'historical'})).s===403,'M1 player cannot alter metadata');
  const secret=await make('NPC','M1 SECRET ENTITY','sl_secret');
  await req('/api/knowledge','gm','POST',{entityId:secret,audience:'group',state:'DISCOVERED'});
  check((await req(path+'?id='+secret,'a')).s===404,'M1 secret entity remains hidden despite legacy grant');
  check((await req(path+'?id='+secret,'gm')).s===200,'M1 SL reads secret entity');
  check((await patch(npc,1,{defaultVisibility:'sl_secret'})).s===200 && (await req(path+'?id='+npc,'a')).s===404,'M1 can revoke entity visibility');
  await patch(npc,2,{defaultVisibility:'player_visible'});
  const blocks='/api/content-blocks';
  const publicBlock=await req(blocks,'gm','POST',{entityId:npc,kind:'bio',content:'M1_BLOCK_PUBLIC',visibility:'player_visible',position:1});
  const secretBlock=await req(blocks,'gm','POST',{entityId:npc,kind:'motivation',content:'M1_BLOCK_SECRET',visibility:'sl_secret',position:0});
  check(publicBlock.s===201&&secretBlock.s===201,'M1 creates both block audiences');
  const playerBlocks=await req(blocks+'?entityId='+npc,'a'),gmBlocks=await req(blocks+'?entityId='+npc,'gm');
  check(playerBlocks.d.blocks.length===1&&!JSON.stringify(playerBlocks.d).includes('M1_BLOCK_SECRET')&&gmBlocks.d.blocks.length===2,'M1 integrated block secrecy');
  check((await req(blocks+'?entityId='+npc+'&id='+secretBlock.d.block.id,'a')).s===404,'M1 guessed secret block ID is hidden');
  const rel='/api/relationships';
  for(const [type,targetId] of [['related_to',place],['appears_in',scene],['located_at',place],['part_of',session]]) {
    const r=await req(rel,'gm','POST',{sourceId:npc,targetId,type,visibility:'group'});
    check(r.s===201&&(await req(rel+'?entityId='+npc+'&id='+r.d.relationship.id,'a')).s===200,'M1 integrated '+type);
    check((await req(rel,'gm','DELETE',{id:r.d.relationship.id})).s===200,'M1 deletes relation without deleting originals');
  }
  const hiddenRel=await req(rel,'gm','POST',{sourceId:npc,targetId:secret,type:'related_to',visibility:'group'});
  check((await req(rel+'?entityId='+npc+'&id='+hiddenRel.d.relationship.id,'a')).s===404,'M1 relation cannot reveal secret endpoint');
  check((await req(path+'?id='+npc,'a')).s===200,'M1 original NPC survives block and relation operations');
  const requestFor=role=>async url=>{const r=await req(url,role);if(r.s!==200)throw new Error('NPC request failed '+r.s);return r.d;};
  const playerNPCs=await loadNPCList(requestFor('a'));
  check(playerNPCs.some(e=>e.id===npc)&&playerNPCs.every(e=>e.type==='NPC')&&!playerNPCs.some(e=>e.id===secret),'M2.1 NPC list uses typed M1 originals and excludes hidden entities');
  check((await req(path+'?type=invalid','gm')).s===400,'M2.1 rejects invalid entity filter');
  const visibleRel=await req(rel,'gm','POST',{sourceId:npc,targetId:place,type:'located_at',visibility:'group'});
  const playerDetail=await loadNPCDetail(requestFor('a'),npc,false);
  const slDetail=await loadNPCDetail(requestFor('gm'),npc,true);
  check(playerDetail.blocks.length===1&&slDetail.blocks.length===2&&slDetail.blocks[0].position===0,'M2.1 detail orders original blocks for each role');
  check(playerDetail.relationships.some(r=>r.id===visibleRel.d.relationship.id)&&!playerDetail.relationships.some(r=>r.id===hiddenRel.d.relationship.id),'M2.1 detail shows authorized relationships only');
  check(!JSON.stringify(playerDetail).includes('M1_SECRET')&&!JSON.stringify(playerDetail).includes('M1_BLOCK_SECRET')&&!JSON.stringify(playerDetail).includes(secret),'M2.1 player detail contains no SL secrets or hidden endpoint IDs');
  check(dossierRelations(npc,playerDetail.relationships,playerDetail.relatedEntities,false).some(g=>g.title==='Orte'),'M2.3 groups authorized original world references');
  check(dossierRelations(npc,slDetail.relationships,slDetail.relatedEntities,true).some(g=>g.title==='SL-INTERN'),'M2.3 separates secret endpoint relations for SL');
  check(!JSON.stringify(dossierSections(playerDetail.entity,playerDetail.blocks,false)).includes('M1_BLOCK_SECRET'),'M2.3 player reading sections contain no secret block');
  check((await loadEntityDossier(requestFor('a'),place,false)).entity.id===place,'M2.3 relationship click reads same non-NPC original without copying');
}
