import { z } from 'zod';
import { storedCanonStatusSchema, playStateSchema } from './types.ts';
import { contentBlockInputSchema } from './content-blocks.ts';
import { coreRelationshipTypeSchema } from './relationships.ts';

const id = z.string().trim().min(1).max(200);
export const npcSaveSchema = z.object({
  id: id.optional(), revision: z.string().length(64).optional(),
  title: z.string().trim().min(1).max(200),
  canonStatus: storedCanonStatusSchema,
  playState: playStateSchema.nullable(),
  defaultVisibility: z.enum(['sl_secret','player_visible']).nullable(),
  // A patch of existing optional content keys, not a new profile model.
  profile: z.object({alias:z.string().max(200).optional(),summary:z.string().max(2000).optional(),image:z.string().max(500).refine(s=>!s || /^\/images\/[a-zA-Z0-9._-]+$/.test(s) || /^\/api\/files\?id=[a-zA-Z0-9_-]+$/.test(s),'Nur vorhandene Bildreferenzen.').optional()}).strict(),
  blocks: z.array(contentBlockInputSchema.omit({entityId:true}).extend({id:id.optional()})).max(100),
  // Existing relationships remain immutable except explicit removal.
  retainedRelationships: z.array(id).max(100),
  addedRelationships: z.array(z.object({targetId:id,type:coreRelationshipTypeSchema,visibility:z.enum(['sl','group'])}).strict()).max(100),
}).strict().superRefine((d,ctx)=>{
  if (!!d.id !== !!d.revision) ctx.addIssue({code:'custom',message:'Bestehende Akte benötigt ihren Lesestand.'});
  const ids=d.blocks.flatMap(b=>b.id?[b.id]:[]);
  if(new Set(ids).size!==ids.length || new Set(d.retainedRelationships).size!==d.retainedRelationships.length)ctx.addIssue({code:'custom',message:'Doppelte Referenz.'});
  if(!d.id && (ids.length || d.retainedRelationships.length))ctx.addIssue({code:'custom',message:'Neue Akte darf keine fremden Inhalte übernehmen.'});
  if(d.addedRelationships.some(r=>r.targetId===d.id))ctx.addIssue({code:'custom',message:'Keine Selbstbeziehungen.'});
});
export type NPCSave = z.infer<typeof npcSaveSchema>;
export function npcProfilePatch(current:NPCSave['profile'],original:NPCSave['profile']){
  const patch:NPCSave['profile']={};
  for(const key of ['alias','summary','image'] as const)if(current[key]!==original[key])patch[key]=current[key];
  return patch;
}
