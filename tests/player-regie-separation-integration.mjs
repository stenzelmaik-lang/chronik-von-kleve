import {engineFixture} from './fixtures/engine-character.mjs';

export async function playerRegieSeparationIntegration({req,check}) {
  const marker = 'CP2_03B_PRIVATE_PLAYER_NOTE';
  const note = await req('/api/records','a','POST',{
    kind:'notizen',title:marker,visibility:'sl',body:{text:marker},
  });
  check(note.s===200,'CP2-03B test note belongs to an ordinary player');

  const player = await req('/api/records?kind=notizen','b');
  const gmPlayer = await req('/api/records?kind=notizen','gm');
  const gmRegie = await req('/api/records?kind=notizen&view=sl','gm');
  check(player.s===200&&!JSON.stringify(player.d).includes(marker),'CP2-03B ordinary player gets only player-projected records');
  check(gmPlayer.s===200&&!JSON.stringify(gmPlayer.d).includes(marker),'CP2-03B SL personal area gets only player-projected records');
  check(gmRegie.s===200&&gmRegie.d.records.some(row=>row.id===note.d.id&&row.body.text===marker),'CP2-03B Command Center request retains explicit SL records');
  check((await req('/api/records?kind=notizen&view=sl','b')).s===403,'CP2-03B ordinary player cannot request SL records');
  check((await req('/api/records?kind=notizen&view=sl','a')).s===403,'CP2-03B record ownership does not grant SL inspection');
  check(!JSON.stringify((await req('/api/dashboard','gm')).d).includes(marker),'CP2-03B SL personal dashboard gets only player-projected data');

  const slSession = await req('/api/records','gm','POST',{
    kind:'sitzungen',title:'CP2_03B_SL_SESSION',visibility:'sl',body:{summary:'CP2_03B_SL_ONLY'},
  });
  check(slSession.s===200,'CP2-03B SL-only campaign session exists');
  check(!JSON.stringify((await req('/api/records?kind=sitzungen','gm')).d).includes(slSession.d.id),'CP2-03B own SL-only campaign records stay out of personal records');
  check(!JSON.stringify((await req('/api/dashboard','gm')).d).includes('CP2_03B_SL_SESSION'),'CP2-03B own SL-only session stays out of personal dashboard');
  check((await req('/api/records?kind=sitzungen&view=sl','gm')).d.records.some(row=>row.id===slSession.d.id),'CP2-03B SL-only session remains in Command Center records');

  const character = await req('/api/records','gm','POST',{
    kind:'charaktere',title:'CP2-03B OWN SL CHARACTER',visibility:'private',body:{...engineFixture},
  });
  check(character.s===200,'CP2-03B SL can retain an own player character');
  const selected = await req('/api/character-selection','gm','PATCH',{characterId:character.d.id});
  const own = await req('/api/dashboard','gm');
  check(selected.s===200&&own.s===200&&own.d.character?.id===character.d.id,'CP2-03B own active character remains selectable in SL personal area');
  check((await req('/api/records?kind=charaktere&view=sl','gm')).s===200,'CP2-03B explicit SL character roster remains available');
}
