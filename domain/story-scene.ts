import { z } from 'zod';
import { isRichTextWithinLimit, sanitizeRichTextInput } from './location-rich-text.ts';

const id = z.string().min(1).max(100);
const optionalId = z.string().max(100).default('');
const text = z.string().max(65000).transform((v,ctx)=>{try{return sanitizeRichTextInput(v);}catch{ctx.addIssue({code:'custom',message:'Ungültiges oder zu komplexes HTML.'});return '';}}).refine(v => isRichTextWithinLimit(v, 10000), 'Dieser Text ist zu lang oder ungültig formatiert.');
const ids = z.array(id).max(30).refine(v => new Set(v).size === v.length, 'Eine Akte darf nur einmal verknüpft werden.');
export const sceneTabs = { narration: 'Erzählung', persons: 'Personen', interaction: 'Interaktion', secrets: 'Geheimnisse', consequences: 'Konsequenzen' } as const;
export const sceneStatusNames = { prepared: 'Vorbereitet', active: 'Läuft', paused: 'Pausiert', completed: 'Abgeschlossen' } as const;

export const sceneElementKinds=['text','sl-note','description','object','clue','check','dialogue','encounter','place','person','image','audio','video','handout','puzzle','pager'] as const;
/** Prepared pager message (ULTIO pager). The element id becomes the message id when the GM plays it, so it is sent once.
 * Limits match the live pager contract; an empty recipient list means the whole round. Optional, so older scenes stay valid. */
export const scenePagerMax={sender:80,title:80,text:280,recipients:30} as const;
export const scenePagerSchema=z.object({sender:z.string().trim().max(scenePagerMax.sender).default(''),text:z.string().trim().max(scenePagerMax.text).default(''),priority:z.enum(['normal','hoch']).default('normal'),recipientIds:z.array(id).max(scenePagerMax.recipients).default([]).refine(v=>new Set(v).size===v.length,'Empfänger dürfen nicht doppelt sein.')}).strict();
export type ScenePager=z.infer<typeof scenePagerSchema>;
export const emptyScenePager=():ScenePager=>({sender:'',text:'',priority:'normal',recipientIds:[]});
export const sceneElementSchema=z.object({id:z.string().uuid(),kind:z.enum(sceneElementKinds),title:z.string().trim().min(1).max(200),text,referenceId:optionalId,fileId:optionalId,pager:scenePagerSchema.optional()}).strict()
  .refine(e=>e.kind==='pager'?e.title.length<=scenePagerMax.title&&!e.referenceId&&!e.fileId:!e.pager,'Pager-Bausteine haben einen Titel bis 80 Zeichen und keine Datei; andere Bausteine tragen keine Pager-Daten.');
export type SceneElement=z.infer<typeof sceneElementSchema>;
/** Prepared YouTube music of a scene: only a title and the video id, no file. Optional, so older scenes stay valid. */
export const sceneYoutubeMax=8;
export const sceneYoutubeSchema=z.object({id:z.string().uuid(),title:z.string().trim().max(200),videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/,'Kein gültiger YouTube-Link.')}).strict();
export type SceneYoutube=z.infer<typeof sceneYoutubeSchema>;
// Preparation has no execution flags. Only an explicit SL command creates a run.
export const sceneDocumentSchema = z.object({
  archived: z.boolean().default(false),
  title: z.string().trim().min(1).max(200), storyId: optionalId, placeId: optionalId,
  parentId: optionalId, sessionIds: ids.default([]), backdropFileId: optionalId, favorite:z.boolean().default(false),pinned:z.boolean().default(false), elements:z.array(sceneElementSchema).max(100).default([]).refine(v=>new Set(v.map(e=>e.id)).size===v.length,'Elemente benötigen eindeutige Identitäten.'),
  narration: text, atmosphere: text, gmNotes: text, dialogueNotes: text,
  interactions: text, secrets: text, visions: text.default(''), possibleConsequences: text,
  visionRecipientIds:z.array(id).max(20).default([]).refine(v=>new Set(v).size===v.length,'Empfänger dürfen nicht doppelt sein.'),
  visionFileIds:z.array(id).max(20).default([]).refine(v=>new Set(v).size===v.length,'Dateien dürfen nicht doppelt sein.'),
  youtube: z.array(sceneYoutubeSchema).max(sceneYoutubeMax).refine(v=>new Set(v.map(t=>t.id)).size===v.length,'Titel dürfen nicht doppelt sein.').optional(),
  npcIds: ids, clueIds: ids,
  possibilities: z.array(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200), text: z.string().max(3000) }).strict()).max(50)
    .refine(v => new Set(v.map(p => p.id)).size === v.length, 'Möglichkeiten dürfen nicht doppelt sein.'),
}).strict();
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;
export const emptyScene = (storyId = ''): SceneDocument => ({ archived:false,title: 'Neue Szene', storyId, placeId: '',parentId:'',sessionIds:[],backdropFileId:'',favorite:false,pinned:false,elements:[], narration: '', atmosphere: '', gmNotes: '', dialogueNotes: '', interactions: '', secrets: '', visions: '', visionRecipientIds:[],visionFileIds:[],possibleConsequences: '', npcIds: [], clueIds: [], possibilities: [] });
export const sceneTargetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('group') }).strict(),
  z.object({ scope: z.literal('character'), characterId: id }).strict(),
]);
export type SceneTarget = z.infer<typeof sceneTargetSchema>;
export const sceneParticipantsSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('group') }).strict(),
  z.object({ scope: z.literal('characters'), characterIds: ids.refine(v => v.length > 0, 'Wähle mindestens einen Charakter für diese Teilgruppe.') }).strict(),
]);
export type SceneParticipants = z.infer<typeof sceneParticipantsSchema>;
export const sceneRunSchema = z.object({
  id: z.string().uuid(), sessionId: id, label: z.string().trim().min(1).max(120),
  participants: sceneParticipantsSchema, status: z.enum(['active', 'paused', 'completed']),
  startedAt: z.string().datetime(), updatedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
  previousRunId: z.string().uuid().nullable(),
}).strict();
export type SceneRun = z.infer<typeof sceneRunSchema>;
export const scenePublicationSchema = z.object({
  target: sceneTargetSchema, title: z.string().min(1).max(200), narration: text,
  placeId: optionalId, npcIds: ids, clueIds: ids, publishedAt: z.string().datetime(), sourceVersion: z.number().int().min(1),
}).strict();
export type ScenePublication = z.infer<typeof scenePublicationSchema>;
export const sceneStateSchema = z.object({
  documentKind: z.literal('story_scene'), runs: z.array(sceneRunSchema).max(500), publications: z.array(scenePublicationSchema).max(101),
}).strict().superRefine((s, ctx) => {
  if (new Set(s.runs.map(r => r.id)).size !== s.runs.length || new Set(s.publications.map(p => targetKey(p.target))).size !== s.publications.length)
    ctx.addIssue({ code: 'custom', message: 'Dieser Szenenstand enthält doppelte Identitäten.' });
});
export type SceneState = z.infer<typeof sceneStateSchema>;
export type SceneView = { id: string; version: number; updatedAt: string; document: SceneDocument; state: SceneState };
export type SceneSummary = Pick<SceneView, 'id' | 'version' | 'updatedAt'> & { title: string; archived?:boolean; storyId: string; placeId: string; parentId:string; sessionIds:string[]; favorite:boolean;pinned:boolean;searchText:string;elements:Pick<SceneElement,'id'|'title'|'kind'>[]; preparation?: ReturnType<typeof import('./session-overview.ts').scenePreparation>; runs: SceneRun[] };
export type SceneHistory = { id: string; version: number; action: string; createdAt: string; document: SceneDocument; state: SceneState };
export type PlayerScene = { id: string; title: string; narration: string; publishedAt: string; place: { id: string; title: string } | null; persons: { id: string; title: string }[]; clues: { id: string; title: string; text: string; state: string }[]; runs: { id: string; sessionId: string; label: string; status: SceneRun['status'] }[] };
export function targetKey(t: SceneTarget) { return t.scope === 'group' ? '@group' : t.characterId; }
export function participantMatches(p: SceneParticipants, characterId?: string) { return p.scope === 'group' || !!characterId && p.characterIds.includes(characterId); }
export function targetMatches(t: SceneTarget, characterId?: string) { return t.scope === 'group' || !!characterId && t.characterId === characterId; }

const revision = z.number().int().min(1), base = { id, version: revision };
export const sceneCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), clientRequestId: z.string().uuid(), document: sceneDocumentSchema }).strict(),
  z.object({ action: z.literal('save'), ...base, document: sceneDocumentSchema }).strict(),
  z.object({action:z.literal('restore'),...base,historyId:z.string().uuid()}).strict(),
  z.object({ action: z.literal('activate'), ...base, runId: z.string().uuid(), sessionId: id, label: z.string().trim().min(1).max(120), participants: sceneParticipantsSchema }).strict(),
  z.object({ action: z.literal('pause'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('resume'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('complete'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('reopen'), ...base, runId: z.string().uuid(), newRunId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('publish'), ...base, target: sceneTargetSchema }).strict(),
  z.object({ action: z.literal('withdraw'), ...base, target: sceneTargetSchema }).strict(),
]);
export type SceneCommand = z.infer<typeof sceneCommandSchema>;
