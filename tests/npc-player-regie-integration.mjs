import {loadNPCList,loadNPCDetail,npcListPath} from '../app/spielbereich/modules/npc-data.ts';

export async function npcPlayerRegieIntegration({req,check}) {
  const publicMark='CP203H_PUBLIC',secretMark='CP203H_SECRET';
  const made=await req('/api/entities/npc','gm','POST',{
    title:publicMark,canonStatus:'confirmed',playState:'unplayed',defaultVisibility:'player_visible',
    profile:{role:secretMark,field_visibility:{name:'player_visible',role:'sl_secret'}},
    blocks:[
      {kind:'short_profile',content:publicMark,visibility:'player_visible',position:0},
      {kind:'sl_secrets',content:secretMark,visibility:'sl_secret',position:1},
    ],retainedRelationships:[],addedRelationships:[],
  });
  check(made.s===200,'CP2-03H synthetic NPC created');
  const id=made.d.id, encoded=encodeURIComponent(id);
  const read=async(who,view)=>{
    const list=await req(npcListPath(view==='sl'),who);
    const urls=[`/api/entities?id=${encoded}&view=${view}`,`/api/content-blocks?entityId=${encoded}&view=${view}`,`/api/relationships?entityId=${encoded}&view=${view}`];
    const detail=await Promise.all(urls.map(url=>req(url,who)));
    return {list,detail};
  };
  for(const who of ['gm','a']){
    const player=await read(who,'player');
    check(player.list.s===200&&player.detail.every(r=>r.s===200)&&JSON.stringify(player).includes(publicMark)&&!JSON.stringify(player).includes(secretMark),`CP2-03H ${who} player list and direct dossier fetches are projected`);
  }
  const sl=await read('gm','sl');
  check(sl.list.s===200&&sl.detail.every(r=>r.s===200)&&JSON.stringify(sl).includes(secretMark),'CP2-03H SL Regie list and direct dossier fetches retain secrets');
  const denied=await read('a','sl');
  check(denied.list.s===403&&denied.detail.every(r=>r.s===403),'CP2-03H player cannot request SL list or direct dossier data');
  const requestFor=who=>async url=>{const result=await req(url,who);if(result.s!==200)throw Error(`CP2-03H ${who} ${url}: ${result.s}`);return result.d;};
  const playerPaths=[],slPaths=[];
  const playerRequest=async url=>{playerPaths.push(url);return requestFor('gm')(url);};
  const slRequest=async url=>{slPaths.push(url);return requestFor('gm')(url);};
  const [playerList,playerDetail,slList,slDetail]=await Promise.all([
    loadNPCList(playerRequest,false),loadNPCDetail(playerRequest,id,false),
    loadNPCList(slRequest,true),loadNPCDetail(slRequest,id,true),
  ]);
  check(playerList.some(e=>e.id===id)&&!JSON.stringify(playerDetail).includes(secretMark)&&playerPaths.every(p=>p.includes('view=player')),'CP2-03H personal UI loaders use player projection throughout');
  check(slList.some(e=>e.id===id)&&JSON.stringify(slDetail).includes(secretMark)&&slPaths.every(p=>p.includes('view=sl')),'CP2-03H Regie UI loaders use authorized SL projection throughout');
  check(npcListPath(false)!==npcListPath(true),'CP2-03H NPC cache keys separate player and SL lists');
}
