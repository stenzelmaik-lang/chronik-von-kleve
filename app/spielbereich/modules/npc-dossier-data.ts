import type { Entity, Relationship } from '../../../domain/types.ts';
import type { ContentBlock } from '../../../domain/content-blocks.ts';
import {isNPCSLKind} from '../../../domain/npc-profile.ts';

export const entityTypeNames: Record<string, string> = { NPC:'Persönlichkeiten', PLACE:'Orte', SCENE:'Szenen', storyline:'Handlungsstränge', SESSION:'Sitzungen', FACTION:'Organisationen', HANDOUT:'Dokumente', CLUE:'Hinweise', CHARACTER:'Charaktere' };
export const blockKindNames: Record<string, string> = { bio:'Biografie', biography:'Biografie', description:'Beschreibung', profile:'Kurzprofil', text:'Erzähltext', note:'Notiz', motivation:'Motivation', history:'Vergangenheit' };
Object.assign(blockKindNames,{short_profile:'Kurzprofil',personality:'Persönlichkeit',sl_secrets:'Geheimnisse',sl_agenda:'Aktuelle Agenda',sl_playstyle:'Spielweise'});
export function npcReadingSections(blocks:ContentBlock[],gm:boolean){
  const available=blocks.filter(b=>b.content.trim()&&(gm||b.visibility==='player_visible')&&(gm||!isNPCSLKind(b.kind))).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  return {
    short:available.filter(b=>['short_profile','profile'].includes(b.kind)),
    biography:available.filter(b=>['biography','bio','history','description','text'].includes(b.kind)),
    personality:available.filter(b=>b.kind==='personality'),
    internal:gm?available.filter(b=>isNPCSLKind(b.kind)||!['short_profile','profile','biography','bio','history','description','text','personality'].includes(b.kind)):[],
  };
}
export function npcIdentityFacts(entity:Entity){
  const c=entity.content;
  const value=(key:string)=>Array.isArray(c[key])?c[key].filter(v=>typeof v==='string').join(' · '):typeof c[key]==='string'||typeof c[key]==='number'?String(c[key]):'';
  return [['role','Rolle'],['clan','Clan'],['generation','Generation'],['stance','Haltung'],['affiliation','Zugehörigkeit'],['known_for','Bekannt für'],['npc_status','Figurenstatus'],['location_note','Aufenthalt']].map(([key,label])=>({key,label,value:value(key)})).filter(f=>f.value);
}
export const relationNames: Record<string, string> = { related_to:'Verbunden mit', appears_in:'Erscheint in', located_at:'Aufenthaltsort', part_of:'Teil von' };
export function dossierSections(entity: Entity, blocks: ContentBlock[], gm: boolean) {
  return {
    publicBlocks: blocks.filter(b=>b.visibility==='player_visible'),
    secretBlocks: gm ? blocks.filter(b=>b.visibility==='sl_secret') : [],
    gmBody: gm ? entity.gmBody ?? '' : '',
    texts: [ ['summary','Überblick'], ['description','Beschreibung'], ['text','Hintergrund & Biografie'], ['goals','Ziele'], ['motives','Motive'] ]
      .flatMap(([key,title])=>typeof entity.content[key]==='string' && entity.content[key] ? [{key,title,content:entity.content[key] as string}] : []),
  };
}
export function dossierRelations(id: string, relationships: Relationship[], relatedEntities: Entity[], gm: boolean) {
  const groups = new Map<string, { relation: Relationship; entity: Entity; incoming: boolean; secret: boolean }[]>();
  for(const relation of relationships) {
    const otherId=relation.sourceId===id?relation.targetId:relation.sourceId;
    const entity=relatedEntities.find(e=>e.id===otherId);
    if(!entity)continue;
    const secret=relation.visibility!=='group' || entity.defaultVisibility==='sl_secret' || entity.canonStatus==='GM_SECRET';
    if(secret && !gm && (entity.defaultVisibility==='sl_secret'||entity.canonStatus==='GM_SECRET'))continue;
    const key=secret&&gm?'SL-INTERN':entityTypeNames[entity.type]??'Weitere Verknüpfungen';
    groups.set(key,[...(groups.get(key)??[]),{relation,entity,incoming:relation.targetId===id,secret}]);
  }
  return [...groups].map(([title,items])=>({title,items}));
}
