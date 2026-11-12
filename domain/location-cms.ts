import {locationRiskLevels} from "./location-types.ts";
import { z } from "zod";
import { isRichTextWithinLimit, sanitizeRichTextInput } from "./location-rich-text.ts";

const cleanText = (max: number) => z.string().trim().max(max);
const richText = (max: number) => z.string().transform((value, context) => {
  try { return sanitizeRichTextInput(value); }
  catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "HTML ist zu lang oder zu komplex. Bitte vereinfache die Beschreibung." });
    return z.NEVER;
  }
}).pipe(z.string().refine(value => isRichTextWithinLimit(value, max), `Text darf höchstens ${max} sichtbare Zeichen enthalten und muss sichere Formatierungen verwenden.`));

export const geographyDraftSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unknown") }).strict(),
  z.object({
    status: z.literal("exact"),
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
    source: cleanText(300).min(1),
    reference: cleanText(500).optional(),
    reviewedAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    status: z.literal("approximate"),
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
    accuracyMeters: z.number().int().min(1).max(1_000_000),
    source: cleanText(300).min(1),
    reference: cleanText(500).optional(),
    reviewedAt: z.string().datetime({ offset: true }),
  }).strict(),
]);

const rootPayload = z.object({
  title: cleanText(160).min(1),
  subtitle: cleanText(160).optional(),
  district: cleanText(120).optional(),
  address: cleanText(240).optional(),
  mapRisk: z.enum(locationRiskLevels).optional(),
  summary: richText(1600).optional(),
  atmosphere: richText(25000).optional(),
  image: z.string().regex(/^\/images\/[a-zA-Z0-9_.-]+$/).optional(),
  factionSignals: z.array(z.object({
    label: cleanText(160).min(1),
    mode: z.enum(["control", "observation"]),
    visibility: z.enum(["public", "group"]),
  }).strict()).max(20).optional(),
  activity: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    label: cleanText(180).min(1),
    targetLabel: cleanText(160).min(1),
    targetId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    time: cleanText(120).min(1),
    visibility: z.enum(["public", "group"]),
  }).strict()).max(30).optional(),
}).strict();

const areaPayload = z.object({
  title: cleanText(160).min(1),
  playerHint: richText(25000).optional(),
}).strict();

const roomPayload = z.object({
  title: cleanText(160).min(1),
  short: richText(25000).optional(),
}).strict();

const informationPayload = z.object({
  title: cleanText(160).min(1),
  text: richText(25000).optional(),
  noteType: z.enum(["note", "suspicion", "insight", "question", "task", "memory", "theory"]).optional(),
  pinned: z.boolean().optional(),
}).strict();

const gmSecretPayload = z.object({
  text: richText(5000).optional(),
  source: cleanText(500).optional(),
}).strict();

export type LocationLevel = "location" | "area" | "room" | "information";
export type EditorialAudience = "gm" | "public" | "group" | "player";
export type GeographyDraft = z.infer<typeof geographyDraftSchema>;

export function parsePlayerPayload(level: LocationLevel, payload: unknown) {
  const parsed = (level === "location" ? rootPayload
    : level === "area" ? areaPayload
      : level === "room" ? roomPayload
        : informationPayload).safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export function parseGmSecretPayload(payload: unknown) {
  const parsed = gmSecretPayload.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export function parseGeography(value: unknown): GeographyDraft | null {
  const parsed = geographyDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseAudience(value: unknown, playerId?: unknown) {
  if (value === "gm" || value === "public" || value === "group") {
    if (playerId !== undefined && playerId !== null && playerId !== "") return null;
    return { scope: value, key: value === "gm" ? "@gm" : value === "public" ? "@public" : "@group", userId: null } as const;
  }
  if (value === "player" && typeof playerId === "string" && playerId.trim().length > 0 && playerId.length <= 180) {
    return { scope: "player", key: playerId, userId: playerId } as const;
  }
  return null;
}

export function isPlayerSafeCanon(canonStatus: string, content: Record<string, unknown>, attributes: Record<string, unknown>) {
  return canonStatus !== "GM_SECRET" &&
    content.recoveryOnly !== true && content.canonStatus !== "GM_SECRET" && content.canon_status !== "GM_SECRET" &&
    attributes.recoveryOnly !== true && attributes.canonStatus !== "GM_SECRET" && attributes.canon_status !== "GM_SECRET";
}
