import type { Entity, Relationship } from '../../../domain/types.ts';
import type { ContentBlock } from '../../../domain/content-blocks.ts';

export const entityTypeNames: Record<string, string> = { NPC:'Persönlichkeiten', PLACE:'Orte', SCENE:'Szenen', storyline:'Handlungsstränge', SESSION:'Sitzungen', FACTION:'Organisationen', HANDOUT:'Dokumente', CLUE:'Hinweise', CHARACTER:'Charaktere' };
export const blockKindNames: Record<string, string> = { bio:'Biografie', biography:'Biografie', description:'Beschreibung', profile:'Kurzprofil', text:'Erzähltext', note:'Notiz', motivation:'Motivation', history:'Vergangenheit' };
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
