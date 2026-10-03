import type { Entity, Relationship } from '../../../domain/types.ts';
import type { ContentBlock } from '../../../domain/content-blocks.ts';

export const npcListPath = '/api/entities?type=NPC';
type Request = <T>(path: string) => Promise<T>;
export async function loadNPCList(request: Request): Promise<Entity[]> {
  return (await request<{ entities: Entity[] }>(npcListPath)).entities.filter(e => e.type === 'NPC');
}
export async function loadNPCDetail(request: Request, id: string, gm: boolean) {
  const encoded = encodeURIComponent(id);
  const [entityData, blockData, relationData] = await Promise.all([
    request<{ entities: Entity[] }>('/api/entities?id=' + encoded + '&type=NPC'),
    request<{ blocks: ContentBlock[] }>('/api/content-blocks?entityId=' + encoded),
    request<{ relationships: Relationship[] }>('/api/relationships?entityId=' + encoded),
  ]);
  const entity = entityData.entities.find(e => e.id === id && e.type === 'NPC');
  if (!entity) throw new Error('NPC nicht gefunden.');
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
