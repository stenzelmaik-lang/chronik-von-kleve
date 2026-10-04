import { z } from 'zod';
import { storedCanonStatusSchema, playStateSchema } from './types.ts';
import { contentBlockInputSchema } from './content-blocks.ts';
import { coreRelationshipTypeSchema } from './relationships.ts';
import {npcProfileSchema,isNPCSLKind} from './npc-profile.ts';

const id = z.string().trim().min(1).max(200);
export const npcSaveSchema = z.object({
  id: id.optional(), revision: z.string().length(64).optional(),
  title: z.string().trim().min(1).max(200),
  canonStatus: storedCanonStatusSchema,
  playState: playStateSchema.nullable(),
  defaultVisibility: z.enum(['sl_secret','player_visible']).nullable(),
  // A patch of existing optional content keys, not a new profile model.
  profile: npcProfileSchema,
  blocks: z.array(contentBlockInputSchema.omit({entityId:true}).extend({id:id.optional()})).max(100),
  // Existing relationships remain immutable except explicit removal.
  retainedRelationships: z.array(id).max(100),
  addedRelationships: z.array(z.object({targetId:id,type:coreRelationshipTypeSchema,visibility:z.enum(['sl','group']),note:z.string().max(2000).optional()}).strict()).max(100),
}).strict().superRefine((d,ctx)=>{
  if (!!d.id !== !!d.revision) ctx.addIssue({code:'custom',message:'Bestehende Akte benötigt ihren Lesestand.'});
  const ids=d.blocks.flatMap(b=>b.id?[b.id]:[]);
  if(new Set(ids).size!==ids.length || new Set(d.retainedRelationships).size!==d.retainedRelationships.length)ctx.addIssue({code:'custom',message:'Doppelte Referenz.'});
  if(!d.id && (ids.length || d.retainedRelationships.length))ctx.addIssue({code:'custom',message:'Neue Akte darf keine fremden Inhalte übernehmen.'});
  if(d.addedRelationships.some(r=>r.targetId===d.id))ctx.addIssue({code:'custom',message:'Keine Selbstbeziehungen.'});
  if(d.blocks.some(b=>isNPCSLKind(b.kind)&&b.visibility!=='sl_secret'))ctx.addIssue({code:'custom',message:'SL-Inhalte müssen SL-intern bleiben.'});
});
export type NPCSave = z.infer<typeof npcSaveSchema>;
export function npcProfilePatch(current:NPCSave['profile'],original:NPCSave['profile']){
  const patch:NPCSave['profile']={};
  for(const key of Object.keys(current) as (keyof NPCSave['profile'])[])if(JSON.stringify(current[key])!==JSON.stringify(original[key]))Object.assign(patch,{[key]:current[key]});
  return patch;
}
