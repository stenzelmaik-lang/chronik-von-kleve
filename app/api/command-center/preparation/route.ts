import {
  actor,
  database,
  gmOnly,
  sameOrigin,
  input,
  json,
  failure,
  HttpError,
} from "@/server/access";
import { sessionPreparationCommand } from "@/domain/story-preparation";
import {
  preparedSessions,
  preparedSession,
  preparationHistory,
  writePreparation,
} from "@/server/story-preparation";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const a = await actor();
    gmOnly(a);
    const db = database(),
      q = new URL(req.url).searchParams,
      id = q.get("id");
    if (!id) {
      const places = await db
        .prepare(
          "SELECT e.id,e.title FROM location_nodes n JOIN entities e ON e.id=n.entity_id AND e.campaign_id=n.campaign_id WHERE n.campaign_id=? AND n.level IN ('location','area','room') AND COALESCE(json_extract(e.content,'$.recoveryOnly'),0)!=1 ORDER BY e.title",
        )
        .bind(a.campaignId)
        .all<{ id: string; title: string }>();
      return json({
        sessions: await preparedSessions(db, a),
        places: places.results,
      });
    }
    return json({
      session: (await preparedSession(db, a, id)).view,
      ...(q.get("history") === "1"
        ? { history: await preparationHistory(db, a, id) }
        : {}),
    });
  } catch (e) {
    return failure(e, req);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const p = sessionPreparationCommand.safeParse(await input(req));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const c = p.data,
      db = database();
    if (c.action === "create")
      return json(
        {
          session: await writePreparation(db, a, {
            id: "session-" + c.clientRequestId,
            version: 0,
            document: c.document,
            create: true,
          }),
        },
        201,
      );
    if (c.action === "restore") {
      const h = (await preparationHistory(db, a, c.id)).find(
        (h) => h.id === c.historyId,
      );
      if (!h) throw new HttpError(404, "Historischer Stand nicht verfügbar.");
      return json({
        session: await writePreparation(db, a, {
          id: c.id,
          version: c.version,
          document: h.document,
          restored: true,
        }),
      });
    }
    return json({ session: await writePreparation(db, a, c) });
  } catch (e) {
    return failure(e, req);
  }
}
