import { actor, database, json, failure } from '@/server/access';
import { characterKnowledgeContext } from '@/server/character-knowledge';
import { playerScenes, scenePlayerPreview, playerCharacterOptions } from '@/server/story-scenes';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), q = new URL(req.url).searchParams, characterId = q.get('characterId') || undefined, sessionId = q.get('sessionId') || undefined;
    if (a.gm) return json({ scenes: await scenePlayerPreview(db, a, characterId, sessionId), characters: [] });
    const character = characterId ? await characterKnowledgeContext(db, a, characterId) : undefined;
    return json({ scenes: await playerScenes(db, a, character, sessionId), characters: await playerCharacterOptions(db, a) });
  } catch (e) { return failure(e, req); }
}
