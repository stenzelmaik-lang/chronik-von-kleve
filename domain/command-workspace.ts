import { z } from 'zod';
import { isRichTextWithinLimit } from './location-rich-text.ts';

export const commandTools = ['story', 'scene', 'character', 'places', 'dispatch', 'notes', 'moments', 'dossiers', 'dice'] as const;
export type CommandTool = typeof commandTools[number];
export const workspaceModes = ['prepare', 'live', 'recap'] as const;
export type WorkspaceMode = typeof workspaceModes[number];
export const contextId = z.string().max(100);
export const panelSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,70}$/), tool: z.enum(commandTools),
  column: z.union([z.literal(0), z.literal(1)]), height: z.number().finite().min(15).max(100),
  pinnedId: contextId.min(1).nullable().default(null),
}).strict();
export type CommandPanel = z.infer<typeof panelSchema>;
export const workspaceSchema = z.object({
  panels: z.array(panelSchema).min(1).max(10), split: z.number().finite().min(30).max(75),
  favorites: z.array(contextId.min(1)).max(40),
  focus: z.object({ characterId: contextId, storyId: contextId, sessionId: contextId, placeId: contextId, sceneId: contextId.default('') }).strict(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.panels.map(p => p.id)).size !== value.panels.length) ctx.addIssue({ code: 'custom', message: 'Arbeitsflächen müssen unterschiedliche Identitäten haben.' });
  for (const tool of commandTools) {
    if (value.panels.filter(p => p.tool === tool).length > (['character', 'story', 'dossiers', 'places'].includes(tool) ? 3 : 1)) ctx.addIssue({ code: 'custom', message: 'Dieses Werkzeug ist bereits geöffnet.' });
  }
  if (value.panels.some(p => p.pinnedId && !['character', 'story', 'places', 'dossiers'].includes(p.tool))) ctx.addIssue({ code: 'custom', message: 'Dieses Werkzeug besitzt keine anheftbare Akte.' });
  if (new Set(value.favorites).size !== value.favorites.length) ctx.addIssue({ code: 'custom', message: 'Favoriten dürfen nicht doppelt sein.' });
  for (const column of [0, 1]) if (value.panels.filter(p => p.column === column).length > 5) ctx.addIssue({ code: 'custom', message: 'Eine Spalte kann höchstens fünf Werkzeuge enthalten.' });
});
export type CommandWorkspace = z.infer<typeof workspaceSchema>;
export type WorkspaceView = { version: number; workspace: CommandWorkspace; mode: WorkspaceMode; windowRole: 'main' | 'companion' };
export function defaultWorkspace(mode: WorkspaceMode, companion = false): CommandWorkspace {
  const tools: [CommandTool, 0 | 1][] = companion ? [['character', 0], ['dispatch', 1]] : mode === 'prepare'
    ? [['story', 0], ['dossiers', 1]] : mode === 'recap' ? [['moments', 0], ['story', 1]]
    : [['story', 0], ['scene', 1], ['character', 1]];
  return { split: 58, panels: tools.map(([tool, column], i) => ({ id: `${tool}-${i}`, tool, column, height: 50, pinnedId: null })), favorites: [], focus: { characterId: '', storyId: '', sessionId: '', placeId: '', sceneId: '' } };
}
export const storySectionLabels = { core: 'Kern & Konflikt', background: 'Hintergründe', secrets: 'Wissen & Geheimnisse', clues: 'Hinweise', consequences: 'Mögliche Folgen', notes: 'SL-Kommentare' } as const;
export type StorySection = keyof typeof storySectionLabels;
const storyText = z.string().max(65000).refine(value => isRichTextWithinLimit(value, 10000), 'Der Abschnitt ist zu lang oder enthält ungültige Formatierungen.');
export const storyDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sections: z.object({ core: storyText, background: storyText, secrets: storyText, clues: storyText, consequences: storyText, notes: storyText }).strict(),
  references: z.array(contextId.min(1)).max(30),
  possibilities: z.array(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200), text: z.string().max(3000), status: z.enum(['open', 'used', 'discarded']) }).strict()).max(50),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.references).size !== value.references.length || new Set(value.possibilities.map(p => p.id)).size !== value.possibilities.length) ctx.addIssue({ code: 'custom', message: 'Verknüpfungen und Möglichkeiten dürfen nicht doppelt sein.' });
});
export type StoryDocument = z.infer<typeof storyDocumentSchema>;
export type StoryView = StoryDocument & { id: string; version: number; updatedAt: string };
export type StoryHistory = { id: string; version: number; createdAt: string; document: StoryDocument };
export const emptyStory = (): StoryDocument => ({ title: 'Neuer Handlungsstrang', sections: { core: '', background: '', secrets: '', clues: '', consequences: '', notes: '' }, references: [], possibilities: [] });
export type CommandReference = { id: string; title: string; type: string; summary: string };
export type MomentView = { id: string; text: string; sessionId: string; storyId: string; sceneId: string; runId: string; references: string[]; occurredAt: string };
export const momentSchema = z.object({
  clientRequestId: z.string().uuid(), text: z.string().trim().min(1).max(3000),
  sessionId: contextId.min(1), storyId: contextId, sceneId: contextId.default(''), runId: z.union([z.string().uuid(), z.literal('')]).default(''), references: z.array(contextId.min(1)).max(15),
}).strict();
export const commandSyncSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('request-focus') }).strict(),
  z.object({ type: z.literal('focus'), characterId: contextId.optional(), sessionId: contextId.optional(), storyId: contextId.optional(), placeId: contextId.optional(), sceneId: contextId.optional() }).strict(),
  z.object({ type: z.literal('invalidate') }).strict(),
  z.object({ type: z.literal('lock') }).strict(),
]);
