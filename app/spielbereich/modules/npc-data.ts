import type { Entity, Relationship } from '../../../domain/types.ts';
import type { ContentBlock } from '../../../domain/content-blocks.ts';

export const npcListPath = '/api/entities?type=NPC&includeRedacted=1';
export type RedactedNPC={id:string;type:'NPC';title:'TOP SECRET';content:Record<string,never>;redacted:true};
export type NPCListEntry=Entity|RedactedNPC;
export const isRedactedNPC=(entry:NPCListEntry):entry is RedactedNPC=>'redacted' in entry&&entry.redacted===true;
type Request = <T>(path: string) => Promise<T>;
export async function loadNPCList(request: Request): Promise<NPCListEntry[]> {
  const data=await request<{entities:Entity[];redactedNPCs?:{id:string}[]}>(npcListPath);
  return [...data.entities.filter(e=>e.type==='NPC'),...(data.redactedNPCs??[]).map(e=>({id:e.id,type:'NPC' as const,title:'TOP SECRET' as const,content:{},redacted:true as const}))];
}
export async function loadNPCDetail(request: Request, id: string, gm: boolean) {
  return loadEntityDossier(request, id, gm, true);
}
export async function loadEntityDossier(request: Request, id: string, gm: boolean, npcOnly = false) {
  const encoded = encodeURIComponent(id);
  const [entityData, blockData, relationData] = await Promise.all([
    request<{ entities: Entity[] }>('/api/entities?id=' + encoded + (npcOnly ? '&type=NPC' : '')),
    request<{ blocks: ContentBlock[] }>('/api/content-blocks?entityId=' + encoded),
    request<{ relationships: Relationship[] }>('/api/relationships?entityId=' + encoded),
  ]);
  const entity = entityData.entities.find(e => e.id === id && (!npcOnly || e.type === 'NPC'));
  if (!entity) throw new Error(npcOnly ? 'NPC nicht gefunden.' : 'Originalakte nicht gefunden.');
  const relationships = relationData.relationships.filter(r => r.sourceId === id || r.targetId === id);
  const relatedIds = [...new Set(relationships.map(r => r.sourceId === id ? r.targetId : r.sourceId))];
  const relatedEntities = (await Promise.all(relatedIds.map(other => request<{ entities: Entity[] }>('/api/entities?id=' + encodeURIComponent(other)))))
    .flatMap(result => result.entities);
  return {
    entity,
    // Additional presentation safeguard; authorization remains on the server.
    blocks: blockData.blocks.filter(b => b.entityId === id && (gm || b.visibility === 'player_visible'))
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    relationships,
    relatedEntities,
  };
}
