import { z } from "zod";
import {
  isRichTextWithinLimit,
  sanitizeRichTextInput,
} from "./location-rich-text.ts";
export const preparationText = z
  .string()
  .max(65000)
  .transform((v, ctx) => {
    try {
      return sanitizeRichTextInput(v);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Ungültiges oder zu komplexes HTML.",
      });
      return "";
    }
  })
  .refine((v) => isRichTextWithinLimit(v, 10000), "Der Text ist zu lang.");
export const preparationIds = z
  .array(z.string().min(1).max(100))
  .max(100)
  .refine((v) => new Set(v).size === v.length, "Doppelte Verknüpfungen.");
export const sessionPreparationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    date: z.string().max(30).default(""),
    summary: z.string().max(2000).default(""),
    notes: preparationText.default(""),
    storyIds: preparationIds.default([]),
    sceneIds: preparationIds.default([]),
    placeIds: preparationIds.default([]),
    status: z
      .enum(["draft", "ready", "active", "completed", "archived"])
      .default("draft"),
    favorite: z.boolean().default(false),
    pinned: z.boolean().default(false),
  })
  .strict();
export type SessionPreparation = z.infer<typeof sessionPreparationSchema>;
export type PreparedSession = {
  id: string;
  version: number;
  updatedAt: string;
  document: SessionPreparation;
};
export const sessionPreparationCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      clientRequestId: z.string().uuid(),
      document: sessionPreparationSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      id: z.string().min(1).max(100),
      version: z.number().int().positive(),
      document: sessionPreparationSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("restore"),
      id: z.string().min(1).max(100),
      version: z.number().int().positive(),
      historyId: z.string().uuid(),
    })
    .strict(),
]);
