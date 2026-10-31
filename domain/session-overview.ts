import type { SceneDocument, SceneSummary } from './story-scene.ts';
import type { SessionPreparation } from './story-preparation.ts';
import { richTextToPlainText, richTextFileIds } from './location-rich-text.ts';

export const preparationSections = {
  narration: 'Erzählung', atmosphere: 'Atmosphäre', dialogueNotes: 'NPCs und Dialoge',
  interactions: 'Interaktionen', secrets: 'Geheimnisse', visions: 'Visionen & persönliche Botschaften',
  possibleConsequences: 'Folgen und Proben', gmNotes: 'SL-Notizen',
} as const;

/** SL-only catalog metadata; no second document or persisted status. */
export function scenePreparation(document: SceneDocument) {
  return {
    narrationExcerpt: richTextToPlainText(document.narration).replace(/\s+/g, " ").trim().slice(0, 280),
    sections: Object.entries(preparationSections).filter(([key]) =>
      richTextToPlainText(document[key as keyof typeof preparationSections]).trim().length > 0 || key === 'visions' && !!document.whispers?.length,
    ).map(([key]) => key),
    npcIds: [...document.npcIds],
    clueIds: [...document.clueIds],
    embeddedFileIds: [...new Set([
      ...Object.keys(preparationSections).flatMap(key => richTextFileIds(document[key as keyof typeof preparationSections])),
      ...document.elements.flatMap(element => richTextFileIds(element.text)),
      ...(document.whispers||[]).flatMap(w => [...w.fileIds,...richTextFileIds(w.text)]),
    ])],
    materials: document.elements.filter(e => e.referenceId || e.fileId).map(e => ({
      id: e.id, title: e.title, kind: e.kind, referenceId: e.referenceId, fileId: e.fileId,
    })),
  };
}

/** Explicit session order first; older scene-side links follow without rewriting them. */
export function orderedSessionScenes(sessionId: string, document: SessionPreparation, scenes: SceneSummary[]) {
  const byId = new Map(scenes.map(scene => [scene.id, scene]));
  const ordered = [...new Set(document.sceneIds)].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const included = new Set(ordered.map(scene => scene.id));
  return [...ordered, ...scenes.filter(scene => scene.sessionIds.includes(sessionId) && !included.has(scene.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'de') || a.id.localeCompare(b.id))];
}

/** Live direction offers the evening's own scenes in planned order. All other
 * active campaign scenes stay reachable for improvisation, listed apart. */
export function liveSceneChoice(sessionId: string, sceneIds: string[], scenes: SceneSummary[]) {
  const active = scenes.filter(scene => !scene.archived);
  const session = orderedSessionScenes(sessionId, { sceneIds } as SessionPreparation, active);
  const included = new Set(session.map(scene => scene.id));
  return { session, more: active.filter(scene => !included.has(scene.id)) };
}
