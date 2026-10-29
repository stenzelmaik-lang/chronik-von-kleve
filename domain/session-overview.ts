import type { SceneDocument, SceneSummary } from './story-scene.ts';
import type { SessionPreparation } from './story-preparation.ts';
import { richTextToPlainText, richTextFileIds } from './location-rich-text.ts';

export const preparationSections = {
  narration: 'Erzählung', atmosphere: 'Atmosphäre', dialogueNotes: 'NPCs und Dialoge',
  interactions: 'Interaktionen', secrets: 'Geheimnisse',
  possibleConsequences: 'Folgen und Proben', gmNotes: 'SL-Notizen',
} as const;

/** SL-only catalog metadata; no second document or persisted status. */
export function scenePreparation(document: SceneDocument) {
  return {
    sections: Object.entries(preparationSections).filter(([key]) =>
      richTextToPlainText(document[key as keyof typeof preparationSections]).trim().length > 0,
    ).map(([key]) => key),
    npcIds: [...document.npcIds],
    clueIds: [...document.clueIds],
    embeddedFileIds: [...new Set([
      ...Object.keys(preparationSections).flatMap(key => richTextFileIds(document[key as keyof typeof preparationSections])),
      ...document.elements.flatMap(element => richTextFileIds(element.text)),
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
