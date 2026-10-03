import { z } from 'zod';

export const contentBlockVisibilitySchema = z.enum(['sl_secret', 'player_visible']);
export const contentBlockInputSchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  kind: z.string().trim().min(1).max(100),
  content: z.string().max(90000),
  visibility: contentBlockVisibilitySchema,
  position: z.number().int().min(0).max(2147483647),
}).strict();
export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;
export type ContentBlock = ContentBlockInput & { id: string };
