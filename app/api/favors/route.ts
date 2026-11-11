import { z } from 'zod';
import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from '@/server/access';
import { favorActions, favorDirections, favorKinds, favorVisibilities } from '@/domain/favors-ledger';
import { validCalendarDate } from '@/domain/calendar-date';
import { changeFavor, decideFavorCrisis, favorsOverview, proposeFavor } from '@/server/favors-ledger';

export const dynamic = 'force-dynamic';
const id = z.string().trim().min(1).max(100);
const date = z.string().refine(validCalendarDate);
const text = z.string().trim().max(2000);
const description = text.min(3);
const schema = z.union([
  z.object({ action: z.literal('decide-crisis'), operationId: z.string().uuid(), id, version: z.number().int().positive(), decision: description }).strict(),
  z.object({
    action: z.literal('propose'), operationId: z.string().uuid(), characterId: id, npcId: id,
    kind: z.enum(favorKinds), direction: z.enum(favorDirections), visibility: z.enum(favorVisibilities).default('parties'),
    tier: z.number().int().min(1).max(3).optional(), markers: z.number().int().min(1).max(20).optional(),
    description, terms: text.default(''), dueOn: date.optional(), gmNote: text.optional(), legacyKey: z.string().max(210).optional(),
  }).strict(),
  z.object({
    action: z.enum(favorActions), operationId: z.string().uuid(), id, version: z.number().int().positive(), reason: description,
    amount: z.number().int().min(1).max(20).optional(), npcId: id.optional(), markers: z.number().int().min(1).max(20).optional(),
    tier: z.number().int().min(1).max(3).optional(), description: description.optional(), terms: text.optional(),
    dueOn: date.nullable().optional(), gmNote: text.optional(),
  }).strict(),
]);
async function scope(req: Request) {
  const a = await actor();
  const sl = new URL(req.url).searchParams.get('view') === 'sl';
  if (sl) gmOnly(a);
  return { actor: a, sl };
}
export async function GET(req: Request) {
  try {
    const viewer = await scope(req);
    const raw = new URL(req.url).searchParams.get('id');
    if (raw !== null && !id.safeParse(raw).success) throw new HttpError(400, 'Ungültige Kennung.');
    return json(await favorsOverview(database(), viewer, raw ?? undefined));
  } catch (error) { return failure(error, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const viewer = await scope(req);
    const parsed = schema.safeParse(await input(req, 12_000));
    if (!parsed.success) throw new HttpError(400, 'Ungültiger Gefallen oder Übergang.');
    const db = database(), now = new Date().toISOString();
    if (parsed.data.action === 'decide-crisis') return json(await decideFavorCrisis(db, viewer, parsed.data, now));
    return json(await (parsed.data.action === 'propose'
      ? proposeFavor(db, viewer, parsed.data, now)
      : changeFavor(db, viewer, parsed.data, now)));
  } catch (error) { return failure(error, req); }
}
