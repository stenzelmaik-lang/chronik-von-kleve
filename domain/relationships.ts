import { z } from 'zod';
import { visibilitySchema } from './types.ts';

export const coreRelationshipTypeSchema = z.enum(['related_to','appears_in','located_at','part_of']);
export const relationshipInputSchema = z.object({
  sourceId: z.string().trim().min(1).max(200),
  targetId: z.string().trim().min(1).max(200),
  type: coreRelationshipTypeSchema,
  visibility: visibilitySchema.default('sl'),
  note: z.string().max(2000).optional(),
}).strict().refine(d=>d.sourceId!==d.targetId,{message:'Selbstbeziehungen sind nicht unterstützt.'});
export type RelationshipInput = z.infer<typeof relationshipInputSchema>;
